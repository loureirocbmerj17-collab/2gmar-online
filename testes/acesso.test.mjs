import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarRg,senhaValida} from '../lib/acesso.mjs';
test('RG com pontuação e zeros representa o mesmo militar; senha pessoal não pode repetir RG',()=>{
 assert.equal(normalizarRg('0053.373'),'53373');assert.equal(normalizarRg('53.373'),'53373');
 for(const v of ['abc53373','0','',null,'1234567890123'])assert.equal(normalizarRg(v),null);
 assert.equal(senhaValida('00053373','53373'),false);assert.equal(senhaValida('Senha pessoal 2026','53373'),true);
});
test('primeiro acesso bloqueia dados e RPCs; apenas gestor SAD administra; reset revoga sessões e mantém histórico',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text);create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('iat',coalesce(nullif(current_setting('request.jwt.claim.iat',true),''),'2000000000')::bigint)$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
 for(const arquivo of ['001_base.sql','003_cadastro_estruturado.sql','004_acesso_rg.sql','005_restauracao_administrativa.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+arquivo,import.meta.url),'utf8'));
 const ids=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'];
 for(let i=0;i<ids.length;i++){
 await db.query('insert into auth.users values($1,$2)',[ids[i],`teste${i}@example.test`]);
 await db.query("insert into public.perfis(id,rg,nome_completo,nome_guerra,posto_graduacao,senha_pendente) values($1,$2,'TESTE','TESTE','CB',$3)",[ids[i],i===2?'0053373':String(i+1),i===2]);
 await db.query("insert into public.lotacoes select $1,id,$2 from public.secoes where sigla='SAD'",[ids[i],i===0?'controlador':'integrante']);
 }
 await assert.rejects(()=>db.query("insert into public.perfis(id,rg,nome_completo,nome_guerra,posto_graduacao) values(gen_random_uuid(),'53373','DUP','DUP','CB')"));
 async function como(i){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated');}
 await como(2);assert.equal((await db.query('select count(*)::int n from public.secoes')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.perfis')).rows[0].n,1);
 await assert.rejects(()=>db.query("select public.atualizar_meu_cadastro('21999999999','Rua','a@example.test')"));
 assert.equal((await db.query("update public.perfis set senha_pendente=false returning id")).rows.length,0);
 assert.equal((await db.query("update public.perfis set redefinir_ao_entrar=true returning id")).rows.length,0);
 await assert.rejects(()=>db.query("select public.reservar_tentativa_login('53373')"));
 await como(1);assert.equal((await db.query('select public.pode_gerir_efetivo() ok')).rows[0].ok,false);
 await como(0);assert.equal((await db.query('select public.pode_gerir_efetivo() ok')).rows[0].ok,true);
 await db.exec('reset role');await db.query('update public.perfis set senha_pendente=false where id=$1',[ids[2]]);
 await como(2);assert.equal((await db.query('select public.sessao_liberada() ok')).rows[0].ok,true);
 await db.query("select public.atualizar_meu_cadastro('21999999999','Endereço preservado','a@example.test')");
 await db.exec('reset role');await db.query('insert into auth.sessions values(gen_random_uuid(),$1)',[ids[2]]);
 await db.query("select set_config('request.jwt.claim.role','service_role',false)");await db.exec('set role service_role');
 for(let i=0;i<10;i++)assert.equal((await db.query("select public.reservar_tentativa_login('53373') ok")).rows[0].ok,true);
 assert.equal((await db.query("select public.reservar_tentativa_login('53373') ok")).rows[0].ok,false);
 await db.query('select public.preparar_redefinicao($1,$2)',[ids[2],ids[0]]);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from auth.sessions')).rows[0].n,0);
 assert.equal((await db.query('select endereco from public.dados_cadastrais where perfil_id=$1',[ids[2]])).rows[0].endereco,'Endereço preservado');
 await db.query("select set_config('request.jwt.claim.role','authenticated',false)");await como(2);
 assert.equal((await db.query('select public.sessao_liberada() ok')).rows[0].ok,false);
 await db.exec('reset role');await db.query('update public.perfis set senha_pendente=false where id=$1',[ids[2]]);
 await db.query("select set_config('request.jwt.claim.iat','1',false)");await como(2);
 assert.equal((await db.query('select public.sessao_liberada() ok')).rows[0].ok,false);
 }finally{await db.close();}
});
