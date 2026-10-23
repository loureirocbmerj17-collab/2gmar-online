begin;
alter table public.dados_cadastrais
 add column if not exists cep text not null default '' check(cep='' or cep ~ '^[0-9]{8}$'),
 add column if not exists logradouro text not null default '' check(length(logradouro)<=200),
 add column if not exists numero text not null default '' check(length(numero)<=30),
 add column if not exists bairro text not null default '' check(length(bairro)<=120),
 add column if not exists cidade text not null default '' check(length(cidade)<=120),
 add column if not exists uf text not null default '' check(uf='' or uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
 add column if not exists complemento text not null default '' check(length(complemento)<=150),
 add column if not exists telefone_secundario text not null default '' check(length(telefone_secundario)<=40);
-- O endereço anterior permanece intacto até o titular salvar o novo cadastro.
alter table public.dados_cadastrais drop constraint if exists dados_cadastrais_endereco_check;
alter table public.dados_cadastrais add constraint dados_cadastrais_endereco_check check(length(endereco)<=800);
create or replace function public.atualizar_meu_cadastro_v2(p_dados jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare
 usuario uuid:=auth.uid();
 cep_v text:=regexp_replace(coalesce(p_dados->>'cep',''),'[^0-9]','','g');
 rua_v text:=btrim(coalesce(p_dados->>'logradouro',''));
 numero_v text:=btrim(coalesce(p_dados->>'numero',''));
 bairro_v text:=btrim(coalesce(p_dados->>'bairro',''));
 cidade_v text:=btrim(coalesce(p_dados->>'cidade',''));
 uf_v text:=upper(btrim(coalesce(p_dados->>'uf','')));
 complemento_v text:=btrim(coalesce(p_dados->>'complemento',''));
 telefone_v text:=btrim(coalesce(p_dados->>'telefone',''));
 secundario_v text:=btrim(coalesce(p_dados->>'telefone_secundario',''));
 email_v text:=btrim(coalesce(p_dados->>'email_contato',''));
 endereco_v text;
begin
 if usuario is null or not exists(select 1 from public.perfis where id=usuario and ativo) then raise exception 'Acesso negado';end if;
 if jsonb_typeof(p_dados) is distinct from 'object' or cep_v !~ '^[0-9]{8}$' or rua_v='' or numero_v='' or bairro_v='' or cidade_v='' then raise exception 'Endereço incompleto';end if;
 if telefone_v<>'' and telefone_v !~ '^[+0-9() .-]{8,40}$' then raise exception 'Telefone inválido';end if;
 if secundario_v<>'' and secundario_v !~ '^[+0-9() .-]{8,40}$' then raise exception 'Telefone secundário inválido';end if;
 endereco_v:=rua_v||', '||numero_v||case when complemento_v<>'' then ' - '||complemento_v else '' end||' - '||bairro_v||' - '||cidade_v||'/'||uf_v||' - CEP: '||substr(cep_v,1,5)||'-'||substr(cep_v,6,3);
 insert into public.dados_cadastrais(perfil_id,telefone,telefone_secundario,email_contato,endereco,cep,logradouro,numero,bairro,cidade,uf,complemento,atualizado_em)
 values(usuario,telefone_v,secundario_v,email_v,endereco_v,cep_v,rua_v,numero_v,bairro_v,cidade_v,uf_v,complemento_v,now())
 on conflict(perfil_id) do update set telefone=excluded.telefone,telefone_secundario=excluded.telefone_secundario,email_contato=excluded.email_contato,endereco=excluded.endereco,cep=excluded.cep,logradouro=excluded.logradouro,numero=excluded.numero,bairro=excluded.bairro,cidade=excluded.cidade,uf=excluded.uf,complemento=excluded.complemento,atualizado_em=now();
 insert into public.auditoria(autor_id,acao,alvo_id) values(usuario,'atualizar_cadastro_estruturado',usuario);
end;$$;
revoke all on function public.atualizar_meu_cadastro_v2(jsonb) from public,anon;
grant execute on function public.atualizar_meu_cadastro_v2(jsonb) to authenticated;
-- Mantidas as políticas RLS e a função antiga para não interromper páginas já abertas.
commit;
