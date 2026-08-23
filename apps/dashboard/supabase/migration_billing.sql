-- ── Billing migration ─────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.

-- 1. Create profiles table (safe to run even if it already exists)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  monthly_event_count int not null default 0,
  billing_cycle_start date not null default current_date,
  weekly_ai_count int not null default 0,
  ai_count_reset_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. Add any columns that may be missing (safe to run on an existing table)
alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists monthly_event_count int not null default 0,
  add column if not exists billing_cycle_start date not null default current_date,
  add column if not exists weekly_ai_count int not null default 0,
  add column if not exists ai_count_reset_at timestamptz not null default now();

-- 3. Add plan check constraint if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_plan_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'pro'));
  end if;
end $$;

-- 4. Enable RLS
alter table public.profiles enable row level security;

-- 5. RLS policies
-- SECURITY: users must never be able to write their own profile row.
-- Billing columns (plan, monthly_event_count, weekly_ai_count, ...) are managed
-- exclusively by server code via the service-role client (Stripe webhooks,
-- ingest counting, usage resets). A broad UPDATE policy here would let any
-- authenticated user grant themselves plan='pro'.
drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

revoke insert, update, delete on public.profiles from authenticated;

-- 6. Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Atomic increment helper for monthly_event_count (called from ingest route)
-- Hardened: pinned search_path, rejects non-positive amounts, and execution is
-- restricted to the service role (server code bypasses this via RLS anyway).
create or replace function public.increment_event_count(user_id uuid, amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount is null or amount <= 0 then
    return;
  end if;
  update public.profiles
  set monthly_event_count = monthly_event_count + amount
  where id = user_id;
end;
$$;

revoke execute on function public.increment_event_count(uuid, int) from anon, authenticated;

-- 8. Back-fill a profile row for every existing user
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ── Schema alignment (idempotent — safe to re-run) ───────────────────────────
-- These columns/indexes are written and queried by app code but were missing
-- from supabase/schema.sql, breaking fresh deployments.

-- 9. errors.message_fingerprint — written at ingest, used for grouping,
--    ingest filters, and the resolve flow. Without it, every insert fails.
alter table public.errors
  add column if not exists message_fingerprint text;

create index if not exists errors_project_type_fingerprint
  on public.errors (project_id, event_type, message_fingerprint);

create index if not exists errors_created_at
  on public.errors (created_at);

-- 10. projects.api_key must be unique — ingest looks it up with .single(),
--     which errors out (500) if duplicates ever exist.
create unique index if not exists projects_api_key_unique
  on public.projects (api_key);
