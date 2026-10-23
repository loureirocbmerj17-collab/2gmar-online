begin;
alter table public.perfis
 add column rg_login text generated always as (coalesce(nullif(ltrim(rg,'0'),''),'0')) stored,
 add column senha_pendente boolean not null default false,
 add column sessao_minima_em timestamptz not null default '1970-01-01 UTC';
create unique index perfis_rg_login_unico on public.perfis(rg_login);
create function public.sessao_liberada() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.perfis where id=auth.uid() and ativo and not senha_pendente
 and extract(epoch from sessao_minima_em)::bigint<=coalesce((auth.jwt()->>'iat')::bigint,0))
$$;
create or replace function public.papel_atual() returns text language sql stable security definer set search_path='' as $$
 select papel from public.perfis where id=auth.uid() and public.sessao_liberada()
$$;
create function public.pode_gerir_efetivo() returns boolean language sql stable security definer set search_path='' as $$
 select public.sessao_liberada() and exists(select 1 from public.perfis p where p.id=auth.uid() and
 (p.papel='administrador' or exists(select 1 from public.lotacoes l join public.secoes s on s.id=l.secao_id
 where l.perfil_id=p.id and s.sigla='SAD' and l.funcao in ('chefe','controlador'))))
$$;
create policy perfis_sessao on public.perfis as restrictive for all to authenticated
 using(id=auth.uid() or public.sessao_liberada()) with check(public.sessao_liberada());
create policy secoes_sessao on public.secoes as restrictive for all to authenticated using(public.sessao_liberada()) with check(public.sessao_liberada());
create policy lotacoes_sessao on public.lotacoes as restrictive for all to authenticated using(public.sessao_liberada()) with check(public.sessao_liberada());
create policy cadastro_sessao on public.dados_cadastrais as restrictive for all to authenticated using(public.sessao_liberada()) with check(public.sessao_liberada());
create policy auditoria_sessao on public.auditoria as restrictive for all to authenticated using(public.sessao_liberada()) with check(public.sessao_liberada());
-- Também impede usar as antigas funções de cadastro antes da troca de senha.
create function public.exigir_sessao_liberada() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.role()='authenticated' and not public.sessao_liberada() then raise exception 'Troca de senha obrigatória';end if;
 return new;
end;$$;
create trigger cadastro_exige_senha before insert or update on public.dados_cadastrais for each row execute function public.exigir_sessao_liberada();
create trigger auditoria_exige_senha before insert on public.auditoria for each row execute function public.exigir_sessao_liberada();
create table public.tentativas_login(chave text primary key,inicio timestamptz not null,quantidade integer not null);
alter table public.tentativas_login enable row level security;
revoke all on public.tentativas_login from public,anon,authenticated;
create function public.reservar_tentativa_login(p_chave text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if length(p_chave)>128 then return false;end if;
 insert into public.tentativas_login values(p_chave,now(),1) on conflict(chave) do update
 set inicio=case when tentativas_login.inicio<now()-interval '15 minutes' then now() else tentativas_login.inicio end,
 quantidade=case when tentativas_login.inicio<now()-interval '15 minutes' then 1 else tentativas_login.quantidade+1 end
 returning quantidade into n;
 return n<=10;
end;$$;
create function public.preparar_redefinicao(p_perfil uuid,p_autor uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_perfil=p_autor then raise exception 'Use alterar minha senha';end if;
 if not exists(select 1 from public.perfis where id=p_perfil and ativo and papel='militar') then raise exception 'Conta não disponível para redefinição pela SAD';end if;
 update public.perfis set senha_pendente=true,sessao_minima_em=date_trunc('second',clock_timestamp()) where id=p_perfil;
 delete from auth.sessions where user_id=p_perfil;
 insert into public.auditoria(autor_id,acao,alvo_id) values(p_autor,'redefinir_senha_sad',p_perfil);
end;$$;
revoke all on function public.sessao_liberada(),public.pode_gerir_efetivo(),public.exigir_sessao_liberada(),public.reservar_tentativa_login(text),public.preparar_redefinicao(uuid,uuid) from public,anon,authenticated;
grant execute on function public.sessao_liberada(),public.pode_gerir_efetivo() to authenticated;
grant execute on function public.reservar_tentativa_login(text),public.preparar_redefinicao(uuid,uuid) to service_role;
grant select,insert,update,delete on public.perfis,public.lotacoes,public.dados_cadastrais,public.auditoria,public.tentativas_login to service_role;
grant usage,select on all sequences in schema public to service_role;
commit;
