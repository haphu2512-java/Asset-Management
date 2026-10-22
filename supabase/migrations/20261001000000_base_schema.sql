-- Base tables for assets and transactions, with row level security so each user
-- can only read and change their own rows. Safe to run on a database that already
-- has these tables: existing tables are left as they are and only RLS is (re)applied.

create table if not exists public.assets (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in ('cash', 'bank', 'saving', 'stock', 'crypto', 'lent', 'debt')),
  amount numeric not null default 0 check (amount >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  category text not null,
  amount numeric not null check (amount > 0),
  note text not null default '',
  date date not null
);

alter table public.assets enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Users manage their own assets" on public.assets;
create policy "Users manage their own assets" on public.assets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own transactions" on public.transactions;
create policy "Users manage their own transactions" on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists assets_user_id_idx on public.assets (user_id);
create index if not exists transactions_user_id_date_idx on public.transactions (user_id, date desc);
