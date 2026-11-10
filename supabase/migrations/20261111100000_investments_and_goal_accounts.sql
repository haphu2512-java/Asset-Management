-- Cost basis for holdings, gold / foreign currency pricing, term deposits, detailed debts,
-- goals linked to real accounts, and the AI quota counter. Safe to run more than once.

-- 1. Extra details on assets.
alter table public.assets
  -- 'manual' keeps the price the user typed (e.g. SJC gold) instead of refreshing it.
  add column if not exists price_mode text check (price_mode in ('market', 'manual')),
  -- Yearly rate in percent, for term deposits, loans and debts.
  add column if not exists interest_rate numeric check (interest_rate >= 0),
  add column if not exists start_date date,
  -- Maturity date of a deposit, or the date a loan / debt is due.
  add column if not exists due_date date,
  add column if not exists counterparty text,
  add column if not exists note text;

-- 2. Buy / sell / dividend history of a holding. Quantity, average cost and profit are
--    computed from these rows (src/investments.ts).
create table if not exists public.asset_trades (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id text not null references public.assets (id) on delete cascade,
  side text not null check (side in ('buy', 'sell', 'dividend', 'bonus')),
  date date not null,
  quantity numeric not null default 0 check (quantity >= 0),
  price numeric not null default 0 check (price >= 0),
  fee numeric not null default 0 check (fee >= 0),
  note text,
  account_id text references public.assets (id) on delete set null,
  transaction_id text,
  created_at timestamptz not null default now()
);

create index if not exists asset_trades_asset_id_idx on public.asset_trades (asset_id);
create index if not exists asset_trades_user_id_idx on public.asset_trades (user_id);

-- 3. Goals can point at the account that holds their money, and keep every contribution.
alter table public.goals
  add column if not exists asset_id text references public.assets (id) on delete set null;

create table if not exists public.goal_contributions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id text not null references public.goals (id) on delete cascade,
  amount numeric not null check (amount > 0),
  date date not null,
  account_id text references public.assets (id) on delete set null,
  transaction_id text,
  created_at timestamptz not null default now()
);

create index if not exists goal_contributions_goal_id_idx on public.goal_contributions (goal_id);
create index if not exists goal_contributions_user_id_idx on public.goal_contributions (user_id);

alter table public.asset_trades enable row level security;
alter table public.goal_contributions enable row level security;

drop policy if exists "Users manage their own trades" on public.asset_trades;
create policy "Users manage their own trades" on public.asset_trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own goal contributions" on public.goal_contributions;
create policy "Users manage their own goal contributions" on public.goal_contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. AI requests the calling user has made today, so the app can show what is left.
create or replace function public.ai_usage_today()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select count from public.ai_usage where user_id = auth.uid() and day = current_date),
    0
  );
$$;

revoke all on function public.ai_usage_today() from public, anon;
grant execute on function public.ai_usage_today() to authenticated;
