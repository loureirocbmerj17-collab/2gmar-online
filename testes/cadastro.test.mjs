import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
test('cadastro: migração preserva dados anteriores, compila endereço no banco e restringe gravação ao titular',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/migrations/001_base.sql',import.meta.url),'utf8'));
 const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 for(const [i,id] of [a,b].entries()){
 await db.query('insert into auth.users values($1,$2)',[id,`pessoa${i}@example.test`]);
 await db.query("insert into public.perfis(id,rg,nome_completo,nome_guerra,posto_graduacao) values($1,$2,'TESTE','TESTE','CB')",[id,String(i+1)]);
 }
 await db.query("insert into public.dados_cadastrais(perfil_id,telefone,endereco,email_contato) values($1,'21999999999','Endereço anterior preservado','antes@example.test')",[a]);
 const migracao=await readFile(new URL('../supabase/migrations/003_cadastro_estruturado.sql',import.meta.url),'utf8');
 await db.exec(migracao);await db.exec(migracao);
 let r=await db.query('select endereco,telefone,cep from public.dados_cadastrais where perfil_id=$1',[a]);
 assert.equal(r.rows[0].endereco,'Endereço anterior preservado');assert.equal(r.rows[0].cep,'');assert.equal(r.rows[0].telefone,'21999999999');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.exec('set role authenticated');
 const dados={cep:'01001-000',logradouro:'Praça da Sé',numero:'120',bairro:'Sé',cidade:'São Paulo',uf:'sp',complemento:'Apto 10',telefone:'(21) 99999-9999',telefone_secundario:'(21) 3333-3333',email_contato:'novo@example.test',perfil_id:b,endereco:'Endereço falso'};
 await db.query('select public.atualizar_meu_cadastro_v2($1::jsonb)',[JSON.stringify(dados)]);
 r=await db.query('select * from public.dados_cadastrais');assert.equal(r.rows.length,1);assert.equal(r.rows[0].perfil_id,a);assert.equal(r.rows[0].cep,'01001000');assert.equal(r.rows[0].uf,'SP');
 assert.equal(r.rows[0].endereco,'Praça da Sé, 120 - Apto 10 - Sé - São Paulo/SP - CEP: 01001-000');assert.equal(r.rows[0].telefone_secundario,'(21) 3333-3333');
 await assert.rejects(()=>db.query('select public.atualizar_meu_cadastro_v2($1::jsonb)',[JSON.stringify({...dados,uf:'XX'})]));
 await assert.rejects(()=>db.query('select public.atualizar_meu_cadastro_v2($1::jsonb)',[JSON.stringify({...dados,cep:'123'})]));
 await assert.rejects(()=>db.query("update public.dados_cadastrais set cep='20040020'"));
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);await db.exec('set role authenticated');r=await db.query('select * from public.dados_cadastrais');assert.equal(r.rows.length,0);
 await db.exec('reset role');await db.query('update public.perfis set ativo=false where id=$1',[a]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.exec('set role authenticated');await assert.rejects(()=>db.query('select public.atualizar_meu_cadastro_v2($1::jsonb)',[JSON.stringify(dados)]));
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');await assert.rejects(()=>db.query('select public.atualizar_meu_cadastro_v2($1::jsonb)',[JSON.stringify(dados)]));
 }finally{await db.close();}
});
