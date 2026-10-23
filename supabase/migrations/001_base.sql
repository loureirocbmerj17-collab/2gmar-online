begin;
create table public.secoes (
 id uuid primary key default gen_random_uuid(),
 sigla text not null unique,
 nome text not null,
 pai_id uuid references public.secoes(id),
 ordem integer not null default 0
);
create table public.perfis (
 id uuid primary key references auth.users(id) on delete cascade,
 rg text not null unique check(rg ~ '^[0-9]+$'),
 nome_completo text not null,
 nome_guerra text not null,
 posto_graduacao text not null,
 oficial boolean not null default false,
 papel text not null default 'militar' check(papel in ('administrador','comandante','subcomandante','militar')),
 ativo boolean not null default true,
 criado_em timestamptz not null default now()
);
create table public.lotacoes (
 perfil_id uuid not null references public.perfis(id) on delete cascade,
 secao_id uuid not null references public.secoes(id) on delete cascade,
 funcao text not null check(funcao in ('controlador','chefe','integrante')),
 primary key(perfil_id,secao_id)
);
create table public.dados_cadastrais (
 perfil_id uuid primary key references public.perfis(id) on delete cascade,
 telefone text not null default '' check(length(telefone)<=40),
 endereco text not null default '' check(length(endereco)<=500),
 email_contato text not null default '' check(length(email_contato)<=254),
 atualizado_em timestamptz not null default now()
);
-- Auditoria não contém os valores pessoais, apenas a identidade e o tipo da alteração.
create table public.auditoria (
 id bigint generated always as identity primary key,
 autor_id uuid references auth.users(id),
 acao text not null,
 alvo_id uuid not null,
 criado_em timestamptz not null default now()
);
create function public.papel_atual() returns text language sql stable security definer set search_path='' as $$
 select papel from public.perfis where id=auth.uid() and ativo
$$;
create function public.oficial_atual() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select oficial from public.perfis where id=auth.uid() and ativo),false)
$$;
create function public.pode_ver_secao(p_secao uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists (
 select 1 from public.perfis p, public.secoes s
 where p.id=auth.uid() and p.ativo and s.id=p_secao
 and (p.papel='administrador'
 or (s.sigla='AI' and (p.oficial or exists(select 1 from public.lotacoes l where l.perfil_id=p.id and l.secao_id=s.id and l.funcao='controlador')))
 or (s.sigla<>'AI' and (p.papel in ('comandante','subcomandante') or exists(
 with recursive ancestrais as (select id,pai_id from public.secoes where id=s.id union all select x.id,x.pai_id from public.secoes x join ancestrais a on a.pai_id=x.id)
 select 1 from public.lotacoes l where l.perfil_id=p.id and (l.secao_id=s.id or (l.funcao in ('chefe','controlador') and l.secao_id in (select id from ancestrais)))
 ))))
 )
$$;
create function public.pode_ver_cadastro(p_perfil uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.perfis p where p.id=auth.uid() and p.ativo and (
 p.id=p_perfil or p.papel in ('administrador','comandante','subcomandante') or exists(
 select 1 from public.lotacoes l join public.secoes s on s.id=l.secao_id where l.perfil_id=p.id and s.sigla='SAD'
 )))
$$;
alter table public.secoes enable row level security;
alter table public.perfis enable row level security;
alter table public.lotacoes enable row level security;
alter table public.dados_cadastrais enable row level security;
alter table public.auditoria enable row level security;
create policy secoes_leitura on public.secoes for select to authenticated using(public.pode_ver_secao(id));
create policy perfis_leitura on public.perfis for select to authenticated using(public.pode_ver_cadastro(id));
create policy lotacoes_leitura on public.lotacoes for select to authenticated using(public.pode_ver_cadastro(perfil_id));
create policy cadastro_leitura on public.dados_cadastrais for select to authenticated using(public.pode_ver_cadastro(perfil_id));
create policy auditoria_leitura on public.auditoria for select to authenticated using(public.papel_atual()='administrador');
create policy secoes_admin on public.secoes for all to authenticated using(public.papel_atual()='administrador') with check(public.papel_atual()='administrador');
create policy perfis_admin on public.perfis for all to authenticated using(public.papel_atual()='administrador') with check(public.papel_atual()='administrador');
create policy lotacoes_admin on public.lotacoes for all to authenticated using(public.papel_atual()='administrador') with check(public.papel_atual()='administrador');
create function public.atualizar_meu_cadastro(p_telefone text,p_endereco text,p_email text) returns void language plpgsql security definer set search_path='' as $$
declare usuario uuid:=auth.uid();
begin
 if usuario is null or not exists(select 1 from public.perfis where id=usuario and ativo) then raise exception 'Acesso negado';end if;
 insert into public.dados_cadastrais(perfil_id,telefone,endereco,email_contato,atualizado_em)
 values(usuario,p_telefone,p_endereco,p_email,now()) on conflict(perfil_id) do update set telefone=excluded.telefone,endereco=excluded.endereco,email_contato=excluded.email_contato,atualizado_em=now();
 insert into public.auditoria(autor_id,acao,alvo_id) values(usuario,'atualizar_cadastro',usuario);
end;$$;
-- Sem cadastro automático nem promoção automática do primeiro login.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.secoes,public.perfis,public.lotacoes,public.dados_cadastrais,public.auditoria to authenticated;
grant insert,update,delete on public.secoes,public.perfis,public.lotacoes to authenticated;
revoke all on function public.papel_atual(),public.oficial_atual(),public.pode_ver_secao(uuid),public.pode_ver_cadastro(uuid),public.atualizar_meu_cadastro(text,text,text) from public,anon;
grant execute on function public.papel_atual(),public.oficial_atual(),public.pode_ver_secao(uuid),public.pode_ver_cadastro(uuid),public.atualizar_meu_cadastro(text,text,text) to authenticated;
insert into public.secoes(sigla,nome,ordem) values
 ('SAD','SAD',10),('AI','AI',20),('SOP','SOP',30),('SIESP','SIESP',40),('SSSG','SSSG',50),('SST','SST',60),('APROVISIONAMENTO','APROVISIONAMENTO',70);
insert into public.secoes(sigla,nome,pai_id,ordem)
 select x.sigla,x.sigla,s.id,x.ordem from public.secoes s cross join (values ('SSCO',31),('SSMT',32),('COMAT',33),('NÁUTICA',34)) as x(sigla,ordem) where s.sigla='SOP';
commit;
