import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import test from 'node:test';import assert from 'node:assert/strict';
test('RLS: seção própria, AI, comando, cadastro e tentativa de elevar papel',async()=>{const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/001_base.sql',import.meta.url),'utf8'));
const ids=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004'];
for(let i=0;i<ids.length;i++){await db.query('insert into auth.users values($1,$2)',[ids[i],`teste${i}@example.test`]);await db.query('insert into public.perfis(id,rg,nome_completo,nome_guerra,posto_graduacao,papel,oficial) values($1,$2,$3,$3,$4,$5,$6)',[ids[i],String(i+1),'TESTE','TESTE',i===0?'administrador':i===3?'comandante':'militar',i===2||i===3]);}
await db.query("insert into public.lotacoes select $1,id,'chefe' from public.secoes where sigla='SOP'",[ids[1]]);
async function como(i,sql){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated');return db.query(sql);}
let r=await como(1,'select sigla from public.secoes');assert.deepEqual(r.rows.map(x=>x.sigla).sort(),['COMAT','NÁUTICA','SOP','SSCO','SSMT'].sort());
r=await como(2,'select sigla from public.secoes');assert.deepEqual(r.rows.map(x=>x.sigla),['AI']);
r=await como(3,'select sigla from public.secoes');assert.equal(r.rows.length,11);
r=await como(1,"update public.perfis set papel='administrador' returning id");assert.equal(r.rows.length,0);
r=await como(1,'select id from public.perfis');assert.equal(r.rows.length,1);
await como(1,"select public.atualizar_meu_cadastro('21999999999','Endereço de teste','teste@example.test')");
await assert.rejects(()=>como(1,"update public.dados_cadastrais set telefone='x'"));
r=await como(2,'select * from public.dados_cadastrais');assert.equal(r.rows.length,0);
await db.exec('reset role');await db.query('update public.perfis set ativo=false where id=$1',[ids[1]]);r=await como(1,'select * from public.secoes');assert.equal(r.rows.length,0);
}finally{await db.close();}});
