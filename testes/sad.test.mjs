import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import test from 'node:test';import assert from 'node:assert/strict';
test('SAD: permissões, prioridades, vagas, alas, férias, aceite bilateral, expediente e fila persistente',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text);create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('iat',2000000000)$$;
 create function auth.role() returns text language sql stable as $$select 'authenticated'::text$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
 for(const nome of ['001_base.sql','003_cadastro_estruturado.sql','004_acesso_rg.sql','005_restauracao_administrativa.sql','006_base_efetivo_sad.sql','007_sad_operacional.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+nome,import.meta.url),'utf8'));
 const ids=Array.from({length:4},(_,i)=>'00000000-0000-0000-0000-'+String(i+1).padStart(12,'0'));
 for(let j=0;j<4;j++){
 await db.query('insert into auth.users values($1,$2)',[ids[j],`teste${j}@example.test`]);
 await db.query("insert into public.perfis(id,rg,nome_completo,nome_guerra,posto_graduacao,papel) values($1,$2,'TESTE','TESTE',$3,$4)",[ids[j],String(100+j),j===0?'CAP':'CB',j===0?'administrador':'militar']);
 await db.query("insert into public.dados_funcionais(perfil_id,ordem_chamada,regime,habilitacoes) values($1,$2,'expediente',$3)",[ids[j],j+1,j===1||j===2?['GV']:[]]);
 }
 const posto=(await db.query("insert into public.postos_servico(nome,tipo) values('POSTO TESTE','praia') returning id")).rows[0].id;
 const sec=(await db.query("select id from public.secoes where sigla='SST'")).rows[0].id;
 await db.query("insert into public.lotacoes values($1,$2,'chefe'),($3,$2,'integrante')",[ids[3],sec,ids[2]]);
 async function como(j){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[j]]);await db.exec('set role authenticated');}
 async function op(j,acao,dados){await como(j);return (await db.query('select public.operacao_sad($1,$2::jsonb) r',[acao,JSON.stringify(dados)])).rows[0].r;}
 async function vaga(dia,tipo='ras',q=1,horas=12){return (await op(0,'abrir_vaga',{dia,tipo,horas,quantidade:q,qualificacao:tipo==='ras'?'GV':'',posto_id:posto})).id;}
 await assert.rejects(()=>op(1,'abrir_vaga',{dia:'2099-01-01',tipo:'ras',horas:12,quantidade:1}));
 let v=await vaga('2099-01-01');await op(2,'inscrever',{vaga_id:v});await op(1,'inscrever',{vaga_id:v});
 await como(0);let fila=(await db.query('select * from public.fila_vaga($1)',[v])).rows;assert.equal(fila[0].perfil_id,ids[1]);
 await op(0,'aprovar_proximo',{vaga_id:v});await assert.rejects(()=>op(0,'aprovar_proximo',{vaga_id:v}),/vagas.*preenchidas/);
 v=await vaga('2099-01-02');await op(1,'inscrever',{vaga_id:v});await op(2,'inscrever',{vaga_id:v});await como(0);fila=(await db.query('select * from public.fila_vaga($1)',[v])).rows;assert.equal(fila[0].perfil_id,ids[2],'menos horas supera antiguidade');
 await op(0,'aprovar_proximo',{vaga_id:v});
 // O militar não lê o rascunho nem altera a escala diretamente.
 await como(1);assert.equal((await db.query('select * from public.escala_itens')).rows.length,0);await assert.rejects(()=>db.query("update public.escala_itens set observacao='x'"));
 // Complementação: dois serviços escolhidos por mês e ordem cronológica de escolha.
 const c1=await vaga('2099-02-01','complementacao'),c2=await vaga('2099-02-02','complementacao'),c3=await vaga('2099-02-03','complementacao');
 await op(2,'inscrever',{vaga_id:c1});await op(1,'inscrever',{vaga_id:c1});await como(0);fila=(await db.query('select * from public.fila_vaga($1)',[c1])).rows;assert.equal(fila[0].perfil_id,ids[2]);
 await op(1,'inscrever',{vaga_id:c2});await assert.rejects(()=>op(1,'inscrever',{vaga_id:c3}),/dois serviços/);
 // Ciclos de 3 e 4 dias e bloqueio do dia da própria ala.
 await db.exec('reset role');const ala=(await db.query("select id from public.alas_servico where tipo='praia' and numero=1")).rows[0].id;
 await op(0,'salvar_funcional',{perfil_id:ids[1],regime:'praia',ala_id:ala,posto_id:posto,habilitacoes:['GV']});await op(0,'salvar_ala',{ala_id:ala,referencia:'2099-03-01'});
 v=await vaga('2099-03-01');await assert.rejects(()=>op(1,'inscrever',{vaga_id:v}),/ala/);
 await op(0,'gerar_escala',{dia:'2099-03-01'});await como(0);assert.equal((await db.query("select count(*)::int n from public.escala_itens where dia='2099-03-01'")).rows[0].n,1);
 await db.exec('reset role');const a24=(await db.query("select referencia::text from public.alas_servico where tipo='prontidao' and numero=3")).rows[0].referencia;assert.equal(a24,'2026-10-23');
 // Férias aprovadas removem o ordinário, sem impedir RAS durante o período.
 const ferias=await op(1,'pedir_ferias',{inicio:'2099-03-01',observacao:'Férias antigas',perfil_id:ids[2]});await como(1);assert.equal((await db.query('select perfil_id,fim from public.pedidos_ferias')).rows[0].perfil_id,ids[1]);assert.equal((await db.query('select fim::text from public.pedidos_ferias')).rows[0].fim,'2099-03-30');
 await assert.rejects(()=>op(2,'decidir_ferias',{pedido_id:ferias.id,decisao:'aprovado'}));await op(0,'decidir_ferias',{pedido_id:ferias.id,decisao:'aprovado'});await como(0);assert.equal((await db.query("select * from public.escala_itens where dia='2099-03-01'")).rows.length,0);
 v=await vaga('2099-03-02');await op(1,'inscrever',{vaga_id:v});
 // Permuta só chega à SAD após o aceite do substituto.
 await db.exec('reset role');await db.exec("insert into public.escalas_dias(dia,publicada) values('2099-04-01',true)");const item=(await db.query("insert into public.escala_itens(dia,perfil_id,posto_id,origem,horas) values('2099-04-01',$1,$2,'ordinario',12) returning id",[ids[1],posto])).rows[0].id;
 const permuta=await op(1,'pedir_permuta',{item_id:item,substituto_id:ids[2]});await assert.rejects(()=>op(0,'aprovar_permuta',{permuta_id:permuta.id,decisao:'aprovado'}),/aceitar/);
 await assert.rejects(()=>op(3,'responder_permuta',{permuta_id:permuta.id,decisao:'aceitar'}));await op(2,'responder_permuta',{permuta_id:permuta.id,decisao:'aceitar'});await op(0,'aprovar_permuta',{permuta_id:permuta.id,decisao:'aprovado'});await como(0);assert.equal((await db.query('select perfil_id from public.escala_itens where id=$1',[item])).rows[0].perfil_id,ids[2]);
 await op(3,'expediente',{dia:'2099-05-01',perfil_id:ids[2],secao_id:sec});await assert.rejects(()=>op(1,'expediente',{dia:'2099-05-02',perfil_id:ids[2],secao_id:sec}),/responsável/);await como(1);assert.equal((await db.query("select * from public.escala_itens where origem='expediente'")).rows.length,1);
 // Compulsório realizado move o militar ao fim, sem depender da virada do mês.
 await como(0);let compulsorio=(await db.query("select * from public.fila_compulsorio('GV')")).rows;assert.equal(compulsorio[0].perfil_id,ids[2]);
 const antiga=await vaga('2000-01-01');await db.exec('reset role');const insc=(await db.query("insert into public.inscricoes_servico(vaga_id,perfil_id,status,compulsorio) values($1,$2,'aprovado',true) returning id",[antiga,ids[2]])).rows[0].id;
 await op(0,'realizado',{inscricao_id:insc});await como(0);compulsorio=(await db.query("select * from public.fila_compulsorio('GV')")).rows;assert.equal(compulsorio.at(-1).perfil_id,ids[2]);
 // Carga mista mensal tem teto de 120h, contabilizando aprovados e realizados.
 await db.exec('reset role');for(let dia=1;dia<=5;dia++){const id=(await db.query("insert into public.vagas_servico(dia,tipo,horas,qualificacao,quantidade) values($1,'ras',24,'GV',1) returning id",['2099-06-'+String(dia).padStart(2,'0')])).rows[0].id;await db.query("insert into public.inscricoes_servico(vaga_id,perfil_id,status) values($1,$2,'aprovado')",[id,ids[2]]);}
 v=await vaga('2099-06-10');await assert.rejects(()=>op(2,'inscrever',{vaga_id:v}),/limite/);
 }finally{await db.close();}
});
