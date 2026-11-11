-- Wallets linked to transactions, transfers, budgets, recurring transactions, custom categories
-- and account deletion. Safe to run more than once.

-- 1. Assets: new categories (gold, foreign currency) and balances that may go below zero
--    when more was spent from a wallet than was recorded as coming in.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.assets'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%category%' or pg_get_constraintdef(oid) ilike '%amount%')
  loop
    execute format('alter table public.assets drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.assets
  add constraint assets_category_check
  check (category in ('cash', 'bank', 'saving', 'stock', 'crypto', 'gold', 'fx', 'lent', 'debt'));

-- 2. Transactions: the wallet they belong to, transfers between wallets, and their recurring rule.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.transactions
  add constraint transactions_kind_check check (kind in ('income', 'expense', 'transfer'));

alter table public.transactions
  add column if not exists account_id text references public.assets (id) on delete set null,
  add column if not exists to_account_id text references public.assets (id) on delete set null,
  add column if not exists recurring_id text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists transactions_account_id_idx on public.transactions (account_id);
create index if not exists transactions_to_account_id_idx on public.transactions (to_account_id);

-- Moves `flow` VND into (+) or out of (−) an account. Money flowing into a debt reduces it.
-- Holdings valued as quantity × price are left alone; the app recomputes them from the price.
-- Runs with the caller's rights, so row level security keeps it to the caller's own assets.
create or replace function public.apply_account_flow(p_account text, p_flow numeric)
returns void
language sql
set search_path = public
as $$
  update public.assets
  set amount = amount + case when category = 'debt' then -p_flow else p_flow end
  where id = p_account
    and p_flow <> 0
    and not (
      category in ('stock', 'crypto', 'gold', 'fx')
      and coalesce(symbol, '') <> ''
      and coalesce(quantity, 0) > 0
    );
$$;

-- Keeps account balances in step with transactions: income adds to the account, an expense
-- takes from it, a transfer moves money from account_id to to_account_id. Editing or deleting
-- a transaction first undoes its old effect. src/ledger.ts mirrors this rule on the device.
create or replace function public.apply_transaction_to_accounts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.kind = new.kind
    and old.amount = new.amount
    and old.account_id is not distinct from new.account_id
    and old.to_account_id is not distinct from new.to_account_id then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    if old.kind = 'income' then
      perform public.apply_account_flow(old.account_id, -old.amount);
    else
      perform public.apply_account_flow(old.account_id, old.amount);
    end if;
    if old.kind = 'transfer' then
      perform public.apply_account_flow(old.to_account_id, -old.amount);
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.kind = 'income' then
      perform public.apply_account_flow(new.account_id, new.amount);
    else
      perform public.apply_account_flow(new.account_id, -new.amount);
    end if;
    if new.kind = 'transfer' then
      perform public.apply_account_flow(new.to_account_id, new.amount);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists transactions_apply_to_accounts on public.transactions;
create trigger transactions_apply_to_accounts
  after insert or update or delete on public.transactions
  for each row execute function public.apply_transaction_to_accounts();

-- 3. Monthly spending limit per expense category.
create table if not exists public.budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null,
  amount numeric not null check (amount > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- 4. Transactions that repeat (salary, rent, subscriptions, instalments).
create table if not exists public.recurring_transactions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  category text not null default '',
  amount numeric not null check (amount > 0),
  note text not null default '',
  account_id text references public.assets (id) on delete set null,
  to_account_id text references public.assets (id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date date not null,
  next_date date not null,
  end_date date,
  auto boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists recurring_transactions_user_id_idx on public.recurring_transactions (user_id);

-- 5. The user's own categories, and their changes to built-in ones (same id as the built-in).
create table if not exists public.categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('income', 'expense')),
  label text not null,
  color text not null,
  icon text,
  parent_id text,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.budgets enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.categories enable row level security;

drop policy if exists "Users manage their own budgets" on public.budgets;
create policy "Users manage their own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own recurring transactions" on public.recurring_transactions;
create policy "Users manage their own recurring transactions" on public.recurring_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own categories" on public.categories;
create policy "Users manage their own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Lets a signed-in user delete their account; every table cascades from auth.users.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
