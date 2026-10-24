begin;
alter table public.dados_funcionais add column sugestao jsonb not null default '{}'::jsonb check(jsonb_typeof(sugestao)='object');
update public.alas_servico set referencia=case numero when 1 then date '2026-10-25' when 2 then date '2026-10-26' when 3 then date '2026-10-23' when 4 then date '2026-10-24' end where tipo='prontidao';
insert into public.postos_servico(nome,tipo,ordem) select x.nome,'praia',x.ordem from unnest(array['JOATINGA','CANAL 1','CANAL 2','Q. MAR','POSTO 1','TROPICAL','BOB’S','POSTO 2','FAROL','POSTO 3','POSTO 3,5','POSTO 4','POSTO 5','RIVIERA','POSTO 6','BARRABELA','POSTO 7','G. COAST','POSTO 8','POSTO BR','VIA 11','P. RETORNO','ILHA 26']) with ordinality as x(nome,ordem) on conflict(nome) do nothing;
insert into public.postos_servico(nome,tipo,ordem) select x.nome,'prontidao',x.ordem from unnest(array['OF. CHEFE DE OPERAÇÕES','ADJUNTO AO OF. DE DIA','CMT DA GUARDA','APROVISIONAMENTO','COMUNICAÇÃO (24H)','COMAT / SOP','MOT ASE 489','ENCARREGADO DE MOT / MOT. AR SOS','MOTO AQUÁTICA (24H)','MOTO AQUÁTICA 02 (24H)','GUARNIÇÃO ASE 489 (24X72)']) with ordinality as x(nome,ordem) on conflict(nome) do nothing;
create sequence public.compulsorio_fim_seq;
create table public.escalas_dias(dia date primary key,publicada boolean not null default false,autor_id uuid references public.perfis,publicada_em timestamptz);
create table public.vagas_servico(id uuid primary key default gen_random_uuid(),dia date not null,tipo text not null check(tipo in ('ras','complementacao')),horas integer not null check(horas in (12,24)),qualificacao text not null default '' check(length(qualificacao)<=40),quantidade integer not null check(quantidade between 0 and 200),posto_id uuid references public.postos_servico,aberta boolean not null default true,criado_em timestamptz not null default clock_timestamp(),check(tipo<>'complementacao' or horas=12));
create table public.inscricoes_servico(id uuid primary key default gen_random_uuid(),vaga_id uuid not null references public.vagas_servico,perfil_id uuid not null references public.perfis,status text not null default 'espera' check(status in ('espera','aprovado','realizado','recusado','cancelado')),compulsorio boolean not null default false,criado_em timestamptz not null default clock_timestamp(),unique(vaga_id,perfil_id));
create table public.escala_itens(id uuid primary key default gen_random_uuid(),dia date not null references public.escalas_dias,perfil_id uuid not null references public.perfis,posto_id uuid references public.postos_servico,origem text not null check(origem in ('ordinario','ras','complementacao','expediente','permuta')),horas integer not null check(horas in (12,24)),inscricao_id uuid unique references public.inscricoes_servico,secao_id uuid references public.secoes,observacao text not null default '' check(length(observacao)<=500),unique(dia,perfil_id));
create table public.pedidos_ferias(id uuid primary key default gen_random_uuid(),perfil_id uuid not null references public.perfis,inicio date not null,fim date generated always as (inicio+29) stored,observacao text not null default '' check(length(observacao)<=1000),status text not null default 'pendente' check(status in ('pendente','aprovado','recusado','cancelado')),criado_em timestamptz not null default clock_timestamp());
create table public.permutas_servico(id uuid primary key default gen_random_uuid(),item_id uuid references public.escala_itens on delete set null,dia_servico date not null,solicitante_id uuid not null references public.perfis,substituto_id uuid not null references public.perfis,compensacao date,observacao text not null default '' check(length(observacao)<=1000),status text not null default 'aguardando_militar' check(status in ('aguardando_militar','aguardando_sad','aprovado','recusado','cancelado')),criado_em timestamptz not null default clock_timestamp(),check(solicitante_id<>substituto_id));
create index inscricoes_vaga_status on public.inscricoes_servico(vaga_id,status);
create index inscricoes_militar on public.inscricoes_servico(perfil_id,status);
create index ferias_militar_periodo on public.pedidos_ferias(perfil_id,inicio,fim);
create index escala_dia on public.escala_itens(dia);
alter table public.escalas_dias enable row level security;alter table public.vagas_servico enable row level security;alter table public.inscricoes_servico enable row level security;alter table public.escala_itens enable row level security;alter table public.pedidos_ferias enable row level security;alter table public.permutas_servico enable row level security;
revoke all on public.escalas_dias,public.vagas_servico,public.inscricoes_servico,public.escala_itens,public.pedidos_ferias,public.permutas_servico from public,anon,authenticated;
grant select on public.escalas_dias,public.vagas_servico,public.inscricoes_servico,public.escala_itens,public.pedidos_ferias,public.permutas_servico to authenticated;
grant all on public.escalas_dias,public.vagas_servico,public.inscricoes_servico,public.escala_itens,public.pedidos_ferias,public.permutas_servico to service_role;
create policy dias_leitura on public.escalas_dias for select to authenticated using(public.sessao_liberada() and (publicada or public.pode_gerir_efetivo()));
create policy vagas_leitura on public.vagas_servico for select to authenticated using(public.sessao_liberada());
create policy inscricoes_leitura on public.inscricoes_servico for select to authenticated using(public.sessao_liberada());
create policy itens_leitura on public.escala_itens for select to authenticated using(public.sessao_liberada() and (public.pode_gerir_efetivo() or origem='expediente' or exists(select 1 from public.escalas_dias d where d.dia=escala_itens.dia and d.publicada)));
create policy ferias_leitura on public.pedidos_ferias for select to authenticated using(public.sessao_liberada() and (perfil_id=auth.uid() or public.pode_gerir_efetivo()));
create policy permutas_leitura on public.permutas_servico for select to authenticated using(public.sessao_liberada() and (solicitante_id=auth.uid() or substituto_id=auth.uid() or public.pode_gerir_efetivo()));
create function public.chave_antiguidade(p uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce((select min(f2.ordem_chamada) from public.perfis p2 join public.dados_funcionais f2 on f2.perfil_id=p2.id where regexp_replace(p2.posto_graduacao,' BM.*$','')=regexp_replace(p1.posto_graduacao,' BM.*$','')),f1.ordem_chamada,99999)::bigint*100000000+p1.rg::bigint
 from public.perfis p1 left join public.dados_funcionais f1 on f1.perfil_id=p1.id where p1.id=p
$$;
create function public.dia_da_ala(p uuid,d date) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select a.referencia is not null and mod(d-a.referencia,case a.tipo when 'praia' then 3 else 4 end)=0 from public.dados_funcionais f join public.alas_servico a on a.id=f.ala_id where f.perfil_id=p),false)
$$;
create function public.horas_ras(p uuid,d date) returns integer language sql stable security definer set search_path='' as $$
 select coalesce(sum(v.horas),0)::integer from public.inscricoes_servico i join public.vagas_servico v on v.id=i.vaga_id where i.perfil_id=p and v.tipo='ras' and i.status in ('aprovado','realizado') and date_trunc('month',v.dia)=date_trunc('month',d)
$$;
create function public.apto_vaga(p uuid,v uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.perfis m join public.dados_funcionais f on f.perfil_id=m.id cross join public.vagas_servico x left join public.alas_servico a on a.id=f.ala_id where m.id=p and m.ativo and x.id=v and f.regime<>'a_classificar' and (f.regime='expediente' or (a.id is not null and a.referencia is not null and a.tipo=f.regime)) and not public.dia_da_ala(p,x.dia) and (x.qualificacao='' or x.qualificacao=any(f.habilitacoes)) and not exists(select 1 from public.escala_itens e where e.perfil_id=p and e.dia=x.dia) and (x.tipo<>'ras' or public.horas_ras(p,x.dia)+x.horas<=120))
$$;
create function public.fila_vaga(v uuid) returns table(inscricao_id uuid,perfil_id uuid,posicao bigint,horas_mes integer,apto boolean)
language sql stable security definer set search_path='' as $$
 select i.id,i.perfil_id,row_number() over(order by case when x.tipo='ras' then public.horas_ras(i.perfil_id,x.dia) else 0 end,case when x.tipo='complementacao' then i.criado_em else null end,public.chave_antiguidade(i.perfil_id),i.criado_em,i.id),public.horas_ras(i.perfil_id,x.dia),public.apto_vaga(i.perfil_id,x.id)
 from public.inscricoes_servico i join public.vagas_servico x on x.id=i.vaga_id where x.id=v and i.status='espera' and public.sessao_liberada()
$$;
create function public.fila_compulsorio(q text default '') returns table(perfil_id uuid,posicao bigint)
language sql stable security definer set search_path='' as $$
 select f.perfil_id,row_number() over(order by coalesce(f.compulsorio_ordem,-public.chave_antiguidade(f.perfil_id)),f.perfil_id) from public.dados_funcionais f join public.perfis p on p.id=f.perfil_id where p.ativo and f.regime<>'a_classificar' and (q='' or q=any(f.habilitacoes)) and public.sessao_liberada()
$$;
create function public.pode_expediente(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.sessao_liberada() and (public.pode_gerir_efetivo() or exists(select 1 from public.lotacoes where perfil_id=auth.uid() and secao_id=s and funcao in ('chefe','controlador')))
$$;
create function public.operacao_sad(acao text,dados jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid();gestor boolean:=public.pode_gerir_efetivo();alvo uuid;idv uuid;item uuid;sec uuid;ala uuid;posto uuid;sub uuid;
 dt date;inicial date;comp date;reg text;obs text;decisao text;v public.vagas_servico%rowtype;i public.inscricoes_servico%rowtype;pr public.permutas_servico%rowtype;e public.escala_itens%rowtype;n integer;
begin
 if not public.sessao_liberada() then raise exception 'Entre novamente para continuar';end if;
 perform pg_catalog.pg_advisory_xact_lock(720062);
 obs:=left(coalesce(dados->>'observacao',''),1000);
 if acao in ('salvar_funcional','salvar_ala','salvar_posto','abrir_vaga','editar_vaga','aprovar_proximo','compulsar','realizado','decidir_ferias','aprovar_permuta','gerar_escala','distribuir','publicar') and not gestor then raise exception 'Ação exclusiva da SAD';end if;
 if acao='lotacao' then
  if public.papel_atual()<>'administrador' then raise exception 'Somente a administração principal pode definir responsáveis';end if;
  alvo:=(dados->>'perfil_id')::uuid;sec:=(dados->>'secao_id')::uuid;
  insert into public.lotacoes(perfil_id,secao_id,funcao) values(alvo,sec,dados->>'funcao') on conflict(perfil_id,secao_id) do update set funcao=excluded.funcao;
 elsif acao='salvar_funcional' then
  alvo:=(dados->>'perfil_id')::uuid;reg:=dados->>'regime';ala:=nullif(dados->>'ala_id','')::uuid;posto:=nullif(dados->>'posto_id','')::uuid;
  if reg in ('praia','prontidao') and not exists(select 1 from public.alas_servico where id=ala and tipo=reg) then raise exception 'Escolha uma ala do regime indicado';end if;
  if reg in ('expediente','a_classificar') then ala:=null;end if;
  insert into public.dados_funcionais(perfil_id,regime,ala_id,posto_preferencial,habilitacoes) values(alvo,reg,ala,posto,array(select jsonb_array_elements_text(coalesce(dados->'habilitacoes','[]')))) on conflict(perfil_id) do update set regime=excluded.regime,ala_id=excluded.ala_id,posto_preferencial=excluded.posto_preferencial,habilitacoes=excluded.habilitacoes,atualizado_em=clock_timestamp();
  if length(btrim(coalesce(dados->>'nome_guerra','')))>0 then update public.perfis set nome_guerra=upper(left(btrim(dados->>'nome_guerra'),200)) where id=alvo;end if;
  sec:=nullif(dados->>'secao_id','')::uuid;
  if sec is not null then insert into public.lotacoes values(alvo,sec,'integrante') on conflict do nothing;end if;
 elsif acao='salvar_ala' then
  alvo:=(dados->>'ala_id')::uuid;update public.alas_servico set referencia=(dados->>'referencia')::date where id=alvo;
 elsif acao='salvar_posto' then
  insert into public.postos_servico(nome,tipo,ordem) values(btrim(dados->>'nome'),dados->>'tipo',coalesce((dados->>'ordem')::integer,0)) on conflict(nome) do update set tipo=excluded.tipo,ordem=excluded.ordem returning id into alvo;
 elsif acao='abrir_vaga' then
  posto:=nullif(dados->>'posto_id','')::uuid;
  if dados->>'tipo'='complementacao' and posto is not null and not exists(select 1 from public.postos_servico where id=posto and tipo='praia') then raise exception 'Complementação sempre na praia';end if;
  insert into public.vagas_servico(dia,tipo,horas,qualificacao,quantidade,posto_id) values((dados->>'dia')::date,dados->>'tipo',(dados->>'horas')::integer,coalesce(dados->>'qualificacao',''),(dados->>'quantidade')::integer,posto) returning id into alvo;
 elsif acao='editar_vaga' then
  alvo:=(dados->>'vaga_id')::uuid;n:=(dados->>'quantidade')::integer;
  if n<(select count(*) from public.inscricoes_servico where vaga_id=alvo and status in ('aprovado','realizado')) then raise exception 'A quantidade não pode ficar abaixo dos serviços já aprovados';end if;
  update public.vagas_servico set quantidade=n,aberta=coalesce(dados->>'aberta','')='sim' where id=alvo;
 elsif acao='inscrever' then
  idv:=(dados->>'vaga_id')::uuid;select * into strict v from public.vagas_servico where id=idv;
  if not v.aberta then raise exception 'Vaga fechada pela SAD';end if;
  if v.dia<(clock_timestamp() at time zone 'America/Sao_Paulo')::date then raise exception 'Escolha uma data atual ou futura';end if;
  if not public.apto_vaga(u,idv) then raise exception 'Confira sua ala, habilitação, limite de RAS ou serviço já lançado para esse dia';end if;
  if exists(select 1 from public.inscricoes_servico where vaga_id=idv and perfil_id=u and status in ('espera','aprovado','realizado')) then raise exception 'Você já escolheu essa vaga';end if;
  if v.tipo='complementacao' and (select count(*) from public.inscricoes_servico z join public.vagas_servico w on w.id=z.vaga_id where z.perfil_id=u and w.tipo='complementacao' and date_trunc('month',w.dia)=date_trunc('month',v.dia) and z.status in ('espera','aprovado','realizado'))>=2 then raise exception 'Você já escolheu dois serviços de complementação neste mês';end if;
  insert into public.inscricoes_servico(vaga_id,perfil_id) values(idv,u) on conflict(vaga_id,perfil_id) do update set status='espera',compulsorio=false,criado_em=clock_timestamp() returning id into alvo;
 elsif acao in ('aprovar_proximo','compulsar') then
  idv:=(dados->>'vaga_id')::uuid;select * into strict v from public.vagas_servico where id=idv;
  if (select count(*) from public.inscricoes_servico where vaga_id=idv and status in ('aprovado','realizado'))>=v.quantidade then raise exception 'Todas as vagas do dia estão preenchidas';end if;
  if acao='aprovar_proximo' then
   select f.inscricao_id into alvo from public.fila_vaga(idv) f where f.apto order by f.posicao limit 1;
   if alvo is null then raise exception 'Nenhum voluntário apto na fila';end if;
   update public.inscricoes_servico set status='aprovado' where id=alvo returning * into i;
  else
   if v.tipo<>'ras' then raise exception 'Compulsório disponível somente para RAS';end if;
   if exists(select 1 from public.fila_vaga(idv) f where f.apto) then raise exception 'Há voluntário apto: aprove a fila voluntária primeiro';end if;
   select f.perfil_id into sub from public.fila_compulsorio(v.qualificacao) f where public.apto_vaga(f.perfil_id,idv) order by f.posicao limit 1;
   if sub is null then raise exception 'Nenhum militar apto ao compulsório';end if;
   insert into public.inscricoes_servico(vaga_id,perfil_id,status,compulsorio) values(idv,sub,'aprovado',true) on conflict(vaga_id,perfil_id) do update set status='aprovado',compulsorio=true returning * into i;alvo:=i.id;
  end if;
  insert into public.escalas_dias(dia,autor_id) values(v.dia,u) on conflict do nothing;
  insert into public.escala_itens(dia,perfil_id,posto_id,origem,horas,inscricao_id) values(v.dia,i.perfil_id,v.posto_id,v.tipo,v.horas,i.id);
 elsif acao='cancelar_inscricao' then
  alvo:=(dados->>'inscricao_id')::uuid;select * into strict i from public.inscricoes_servico where id=alvo;
  if not gestor and (i.perfil_id<>u or i.status<>'espera') then raise exception 'Somente a SAD pode cancelar um serviço aprovado';end if;
  if i.status='realizado' then raise exception 'Serviço realizado não pode ser cancelado';end if;
  delete from public.escala_itens where inscricao_id=alvo;update public.inscricoes_servico set status='cancelado' where id=alvo;
 elsif acao='realizado' then
  alvo:=(dados->>'inscricao_id')::uuid;select * into strict i from public.inscricoes_servico where id=alvo;
  select * into strict v from public.vagas_servico where id=i.vaga_id;
  if i.status<>'aprovado' or v.dia>(clock_timestamp() at time zone 'America/Sao_Paulo')::date then raise exception 'Confira a aprovação e a data do serviço';end if;
  update public.inscricoes_servico set status='realizado' where id=alvo;
  if i.compulsorio then update public.dados_funcionais set compulsorio_ordem=nextval('public.compulsorio_fim_seq') where perfil_id=i.perfil_id;end if;
 elsif acao='pedir_ferias' then
  inicial:=(dados->>'inicio')::date;
  if exists(select 1 from public.pedidos_ferias f where f.perfil_id=u and f.status in ('pendente','aprovado') and inicial<=f.fim and inicial+29>=f.inicio) then raise exception 'Já existe solicitação de férias nesse período';end if;
  insert into public.pedidos_ferias(perfil_id,inicio,observacao) values(u,inicial,obs) returning id into alvo;
 elsif acao='decidir_ferias' then
  alvo:=(dados->>'pedido_id')::uuid;decisao:=dados->>'decisao';
  if decisao not in ('aprovado','recusado') then raise exception 'Decisão inválida';end if;
  if not exists(select 1 from public.pedidos_ferias where id=alvo and status='pendente') then raise exception 'Solicitação já analisada';end if;
  update public.pedidos_ferias set status=decisao where id=alvo;
  if decisao='aprovado' then
   update public.permutas_servico pm set status='cancelado' from public.escala_itens es,public.pedidos_ferias f where f.id=alvo and es.perfil_id=f.perfil_id and es.dia between f.inicio and f.fim and pm.item_id=es.id and pm.status in ('aguardando_militar','aguardando_sad');
   delete from public.escala_itens es using public.pedidos_ferias f where f.id=alvo and es.perfil_id=f.perfil_id and es.dia between f.inicio and f.fim and es.origem in ('ordinario','expediente');
  end if;
 elsif acao='pedir_permuta' then
  item:=(dados->>'item_id')::uuid;sub:=(dados->>'substituto_id')::uuid;comp:=nullif(dados->>'compensacao','')::date;
  select * into strict e from public.escala_itens where id=item;
  if e.perfil_id<>u or e.origem<>'ordinario' or e.dia<(clock_timestamp() at time zone 'America/Sao_Paulo')::date then raise exception 'Escolha um serviço ordinário seu, atual ou futuro';end if;
  if not exists(select 1 from public.perfis where id=sub and ativo) then raise exception 'Substituto inválido';end if;
  if exists(select 1 from public.permutas_servico where item_id=item and status in ('aguardando_militar','aguardando_sad')) then raise exception 'Já existe uma permuta pendente para esse serviço';end if;
  insert into public.permutas_servico(item_id,dia_servico,solicitante_id,substituto_id,compensacao,observacao) values(item,e.dia,u,sub,comp,obs) returning id into alvo;
 elsif acao='responder_permuta' then
  alvo:=(dados->>'permuta_id')::uuid;decisao:=dados->>'decisao';select * into strict pr from public.permutas_servico where id=alvo;
  if pr.substituto_id<>u or pr.status<>'aguardando_militar' or decisao not in ('aceitar','recusar') then raise exception 'Resposta não permitida';end if;
  update public.permutas_servico set status=case decisao when 'aceitar' then 'aguardando_sad' else 'recusado' end where id=alvo;
 elsif acao='aprovar_permuta' then
  alvo:=(dados->>'permuta_id')::uuid;decisao:=dados->>'decisao';select * into strict pr from public.permutas_servico where id=alvo;
  if pr.status<>'aguardando_sad' or decisao not in ('aprovado','recusado') then raise exception 'O outro militar precisa aceitar primeiro';end if;
  if decisao='aprovado' then
   select * into strict e from public.escala_itens where id=pr.item_id;
   if e.perfil_id<>pr.solicitante_id then raise exception 'O serviço original foi alterado';end if;
   if exists(select 1 from public.escala_itens where dia=e.dia and perfil_id=pr.substituto_id) then raise exception 'O substituto já tem serviço nesse dia';end if;
   if pr.compensacao is not null then
    select id into item from public.escala_itens where dia=pr.compensacao and perfil_id=pr.substituto_id and origem='ordinario';
    if item is null or exists(select 1 from public.escala_itens where dia=pr.compensacao and perfil_id=pr.solicitante_id) then raise exception 'Confira o serviço de compensação';end if;
    update public.escala_itens set perfil_id=pr.solicitante_id,origem='permuta' where id=item;
   end if;
   update public.escala_itens set perfil_id=pr.substituto_id,origem='permuta' where id=pr.item_id;
  end if;
  update public.permutas_servico set status=decisao where id=alvo;
 elsif acao='expediente' then
  sec:=(dados->>'secao_id')::uuid;dt:=(dados->>'dia')::date;alvo:=(dados->>'perfil_id')::uuid;
  if not public.pode_expediente(sec) then raise exception 'Somente o responsável da seção pode lançar seu expediente';end if;
  if not exists(select 1 from public.perfis where id=alvo and ativo) or (not gestor and not exists(select 1 from public.lotacoes where perfil_id=alvo and secao_id=sec)) then raise exception 'Militar não pertence à seção';end if;
  if exists(select 1 from public.pedidos_ferias where perfil_id=alvo and status='aprovado' and dt between inicio and fim) then raise exception 'Militar está de férias aprovadas';end if;
  if exists(select 1 from public.escala_itens where perfil_id=alvo and dia=dt and (origem<>'expediente' or secao_id<>sec)) then raise exception 'Militar já tem outro serviço nesse dia';end if;
  insert into public.escalas_dias(dia,autor_id) values(dt,u) on conflict do nothing;
  insert into public.escala_itens(dia,perfil_id,origem,horas,secao_id,observacao) values(dt,alvo,'expediente',12,sec,left(obs,500)) on conflict(dia,perfil_id) do update set observacao=excluded.observacao;
 elsif acao='retirar_item' then
  alvo:=(dados->>'item_id')::uuid;select * into strict e from public.escala_itens where id=alvo;
  if not gestor and not(e.origem='expediente' and public.pode_expediente(e.secao_id)) then raise exception 'Retirada não permitida';end if;
  if e.inscricao_id is not null then raise exception 'Cancele o serviço na aba RAS ou complementação';end if;
  update public.permutas_servico set status='cancelado' where item_id=alvo and status in ('aguardando_militar','aguardando_sad');
  delete from public.escala_itens where id=alvo;
 elsif acao='gerar_escala' then
  dt:=(dados->>'dia')::date;
  if exists(select 1 from public.escalas_dias where dia=dt and publicada) then raise exception 'Escala já publicada; faça ajustes individuais';end if;
  insert into public.escalas_dias(dia,autor_id) values(dt,u) on conflict do nothing;
  insert into public.escala_itens(dia,perfil_id,posto_id,origem,horas)
   select dt,f.perfil_id,f.posto_preferencial,'ordinario',case f.regime when 'prontidao' then 24 else 12 end from public.dados_funcionais f join public.perfis p on p.id=f.perfil_id where p.ativo and f.regime in ('praia','prontidao') and public.dia_da_ala(p.id,dt) and not exists(select 1 from public.pedidos_ferias where perfil_id=p.id and status='aprovado' and dt between inicio and fim) on conflict(dia,perfil_id) do nothing;
 elsif acao='distribuir' then
  alvo:=(dados->>'item_id')::uuid;posto:=(dados->>'posto_id')::uuid;
  if not exists(select 1 from public.postos_servico where id=posto and ativo) then raise exception 'Posto inválido';end if;
  select * into strict e from public.escala_itens where id=alvo;
  if e.origem='complementacao' and not exists(select 1 from public.postos_servico where id=posto and tipo='praia') then raise exception 'Complementação sempre na praia';end if;
  update public.escala_itens set posto_id=posto,observacao=left(obs,500) where id=alvo;
 elsif acao='publicar' then
  dt:=(dados->>'dia')::date;
  if not exists(select 1 from public.escala_itens where dia=dt) then raise exception 'Monte a escala antes de publicar';end if;
  if exists(select 1 from public.escala_itens where dia=dt and posto_id is null and origem<>'expediente') then raise exception 'Distribua os militares nos postos antes de publicar';end if;
  update public.escalas_dias set publicada=true,publicada_em=clock_timestamp() where dia=dt;
 else raise exception 'Operação inválida';end if;
 insert into public.auditoria(autor_id,acao,alvo_id) values(u,'sad_'||acao,coalesce(alvo,u));
 return jsonb_build_object('ok',true,'id',alvo);
end;$$;
revoke all on function public.chave_antiguidade(uuid),public.dia_da_ala(uuid,date),public.horas_ras(uuid,date),public.apto_vaga(uuid,uuid),public.fila_vaga(uuid),public.fila_compulsorio(text),public.pode_expediente(uuid),public.operacao_sad(text,jsonb) from public,anon;
grant execute on function public.chave_antiguidade(uuid),public.dia_da_ala(uuid,date),public.horas_ras(uuid,date),public.apto_vaga(uuid,uuid),public.fila_vaga(uuid),public.fila_compulsorio(text),public.pode_expediente(uuid),public.operacao_sad(text,jsonb) to authenticated;
commit;
