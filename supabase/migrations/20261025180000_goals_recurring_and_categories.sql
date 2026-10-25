-- Adds recurring contribution configuration (DCA), categories and tracking to savings goals.
-- Run in the Supabase SQL editor or via `supabase db push`.

alter table public.goals
  add column if not exists type text not null default 'target_amount',
  add column if not exists category text not null default 'saving',
  add column if not exists recurring_amount numeric,
  add column if not exists frequency text not null default 'monthly',
  add column if not exists last_contributed_at date,
  add column if not exists contributions_count integer not null default 0;
