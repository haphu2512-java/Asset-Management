-- Daily per-user quota for the AI Edge Functions (advisor, parse-transaction).

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);

-- Users never touch this table directly; only consume_ai_quota below writes to it.
alter table public.ai_usage enable row level security;

-- Counts one AI request for the calling user and returns false once today's limit is reached.
create or replace function public.consume_ai_quota(daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    return false;
  end if;
  insert into public.ai_usage (user_id, day, count)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update set count = ai_usage.count + 1
  returning count into used;
  return used <= daily_limit;
end;
$$;

revoke all on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;
