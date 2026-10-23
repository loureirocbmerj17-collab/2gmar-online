begin;
-- Marcador controlado pela administração; nunca é recebido do formulário de login.
-- Permite recuperar contas administrativas pelo painel do projeto sem expor chaves.
alter table public.perfis add column if not exists redefinir_ao_entrar boolean not null default false;
commit;
