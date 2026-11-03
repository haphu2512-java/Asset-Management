-- One snapshot of the user's assets per day, so the app can show how net worth
-- and each holding changed since yesterday. The app keeps today's row up to date;
-- once the day is over that row is the baseline for the next day.

create table if not exists public.asset_snapshots (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  net_worth numeric not null,
  total_assets numeric not null,
  total_debt numeric not null,
  -- Amount of each asset by id: {"<asset id>": 1250000, ...}
  amounts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.asset_snapshots enable row level security;

drop policy if exists "Users manage their own asset snapshots" on public.asset_snapshots;
create policy "Users manage their own asset snapshots" on public.asset_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
