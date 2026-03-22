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
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 6. Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Atomic increment helper for monthly_event_count (called from ingest route)
create or replace function public.increment_event_count(user_id uuid, amount int)
returns void as $$
  update public.profiles
  set monthly_event_count = monthly_event_count + amount
  where id = user_id;
$$ language sql security definer;

-- 8. Back-fill a profile row for every existing user
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
