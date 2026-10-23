begin;
create table public.alas_servico(
 id uuid primary key default gen_random_uuid(),tipo text not null check(tipo in ('praia','prontidao')),
 numero integer not null check(numero between 1 and 4),referencia date,
 unique(tipo,numero),check(tipo<>'praia' or numero<=3)
);
insert into public.alas_servico(tipo,numero,referencia) values('praia',1,'2026-10-24'),('praia',2,'2026-10-25'),('praia',3,'2026-10-23'),('prontidao',1,null),('prontidao',2,null),('prontidao',3,null),('prontidao',4,null);
create table public.postos_servico(
 id uuid primary key default gen_random_uuid(),nome text not null unique check(length(nome) between 1 and 100),
 tipo text not null check(tipo in ('praia','prontidao','expediente')),ordem integer not null default 0,ativo boolean not null default true
);
create table public.dados_funcionais(
 perfil_id uuid primary key references public.perfis(id) on delete cascade,
 quadro text not null default '' check(length(quadro)<=60),id_funcional text not null default '' check(length(id_funcional)<=30),nascimento date,
 ordem_chamada integer unique check(ordem_chamada>0),regime text not null default 'a_classificar' check(regime in ('a_classificar','praia','prontidao','expediente')),
 ala_id uuid references public.alas_servico,posto_preferencial uuid references public.postos_servico,
 habilitacoes text[] not null default '{}',compulsorio_ordem bigint,atualizado_em timestamptz not null default now()
);
alter table public.alas_servico enable row level security;
alter table public.postos_servico enable row level security;
alter table public.dados_funcionais enable row level security;
revoke all on public.alas_servico,public.postos_servico,public.dados_funcionais from public,anon,authenticated;
grant select on public.alas_servico,public.postos_servico,public.dados_funcionais to authenticated;
grant all on public.alas_servico,public.postos_servico,public.dados_funcionais to service_role;
create policy alas_leitura on public.alas_servico for select to authenticated using(public.sessao_liberada());
create policy postos_leitura on public.postos_servico for select to authenticated using(public.sessao_liberada());
create policy funcionais_leitura on public.dados_funcionais for select to authenticated using(public.sessao_liberada() and public.pode_ver_cadastro(perfil_id));
create function public.militares_para_escala() returns table(id uuid,rg text,nome text,posto text,regime text,ala_id uuid,habilitacoes text[],ordem_chamada integer)
language sql stable security definer set search_path='' as $$
 select p.id,p.rg,p.nome_guerra,p.posto_graduacao,f.regime,f.ala_id,f.habilitacoes,f.ordem_chamada from public.perfis p left join public.dados_funcionais f on f.perfil_id=p.id
 where p.ativo and public.sessao_liberada() order by f.ordem_chamada nulls last,p.rg::bigint
$$;
revoke all on function public.militares_para_escala() from public,anon;
grant execute on function public.militares_para_escala() to authenticated;
commit;
