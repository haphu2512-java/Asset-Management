-- Market prices for stock/crypto holdings and savings goals.
-- Run in the Supabase SQL editor, or with `supabase db push`.

alter table public.assets
  add column if not exists symbol text,
  add column if not exists quantity numeric,
  add column if not exists price numeric,
  add column if not exists price_updated_at timestamptz;

create table if not exists public.goals (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  target numeric not null check (target > 0),
  saved numeric not null default 0 check (saved >= 0),
  deadline date not null,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

drop policy if exists "Users manage their own goals" on public.goals;
create policy "Users manage their own goals" on public.goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists goals_user_id_idx on public.goals (user_id);
