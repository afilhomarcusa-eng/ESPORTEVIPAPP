-- ESPORTEVIPAPP — configuração do banco no Supabase
-- Como usar: Dashboard do projeto → SQL Editor → New query → cole tudo → Run

-- Tabela única que guarda o estado completo do app (cambistas, lançamentos,
-- pagamentos, gastos, meta, link da planilha) como um documento JSON.
create table if not exists public.app_state (
  id integer primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Segurança em nível de linha ligada, com política liberando o papel "anon"
-- (o app usa a chave anon public; sem esta política, nada funciona).
alter table public.app_state enable row level security;

drop policy if exists "esportevipapp acesso anon" on public.app_state;
create policy "esportevipapp acesso anon"
  on public.app_state
  for all
  to anon
  using (true)
  with check (true);
