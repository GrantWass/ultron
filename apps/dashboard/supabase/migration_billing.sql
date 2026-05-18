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

-- 9. Atomic check-and-increment for monthly_event_count.
-- Locks the profile row, checks the current count against the limit, and
-- increments only if allowed — eliminating the TOCTOU race in the ingest route.
-- Returns true if the increment was applied, false if the limit was already reached.
create or replace function public.check_and_increment_event_count(
  p_user_id uuid,
  p_amount   int,
  p_limit    int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
begin
  select monthly_event_count into v_current
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  if v_current >= p_limit then
    return false;
  end if;

  update public.profiles
  set monthly_event_count = monthly_event_count + p_amount
  where id = p_user_id;

  return true;
end;
$$;

-- ── Regression tracking ────────────────────────────────────────────────────────
-- Records when a fingerprint was resolved so we can flag re-appearances.

create table if not exists public.resolved_fingerprints (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade not null,
  fingerprint text not null,
  resolved_at timestamptz not null default now(),
  unique(project_id, fingerprint)
);

alter table public.resolved_fingerprints enable row level security;

create policy "Owners can manage resolved fingerprints"
  on public.resolved_fingerprints for all
  using (get_project_owner(resolved_fingerprints.project_id) = auth.uid());

create policy "Members can view resolved fingerprints"
  on public.resolved_fingerprints for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = resolved_fingerprints.project_id
        and pm.user_id    = auth.uid()
        and pm.status     = 'accepted'
    )
  );

-- ── Grouped errors view ────────────────────────────────────────────────────────
-- Returns one row per (fingerprint, event_type) group with aggregate counts.
-- Used by /api/errors?grouped=true.

create or replace function public.get_grouped_errors(
  p_project_id uuid,
  p_limit      int         default 50,
  p_offset     int         default 0,
  p_search     text        default null,
  p_event_type text        default null,
  p_browser    text        default null,
  p_os         text        default null,
  p_connection text        default null,
  p_url        text        default null,
  p_from       timestamptz default null,
  p_to         timestamptz default null
)
returns table(
  message_fingerprint text,
  message             text,
  event_type          text,
  count               bigint,
  first_seen          timestamptz,
  last_seen           timestamptz,
  sample_url          text,
  sample_browser      text,
  sample_id           uuid,
  is_regression       boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with grouped as (
    select
      coalesce(e.message_fingerprint, e.message) as fp,
      min(e.message)                                     as message,
      e.event_type,
      count(*)                                           as cnt,
      min(e.created_at)                                  as first_seen,
      max(e.created_at)                                  as last_seen,
      (array_agg(e.url     order by e.created_at desc))[1] as sample_url,
      (array_agg(e.browser order by e.created_at desc))[1] as sample_browser,
      (array_agg(e.id      order by e.created_at desc))[1] as sample_id
    from public.errors e
    where e.project_id = p_project_id
      and (p_from       is null or e.created_at >= p_from)
      and (p_to         is null or e.created_at <= p_to)
      and (p_event_type is null or e.event_type  = p_event_type)
      and (p_search     is null or e.message     ilike '%' || p_search     || '%')
      and (p_browser    is null or e.browser     ilike '%' || p_browser    || '%')
      and (p_os         is null or e.os          ilike '%' || p_os         || '%')
      and (p_connection is null or e.connection  = p_connection)
      and (p_url        is null or e.url         ilike '%' || p_url        || '%')
      and (e.event_type <> 'vital'
           or e.metadata->>'rating' is null
           or e.metadata->>'rating' <> 'good')
    group by fp, e.event_type
  )
  select
    g.fp          as message_fingerprint,
    g.message,
    g.event_type,
    g.cnt         as count,
    g.first_seen,
    g.last_seen,
    g.sample_url,
    g.sample_browser,
    g.sample_id,
    exists(
      select 1 from public.resolved_fingerprints rf
      where rf.project_id = p_project_id
        and rf.fingerprint = g.fp
        and rf.resolved_at < g.last_seen
    ) as is_regression
  from grouped g
  order by g.last_seen desc
  limit  p_limit
  offset p_offset
$$;

create or replace function public.count_grouped_errors(
  p_project_id uuid,
  p_search     text        default null,
  p_event_type text        default null,
  p_browser    text        default null,
  p_os         text        default null,
  p_connection text        default null,
  p_url        text        default null,
  p_from       timestamptz default null,
  p_to         timestamptz default null
)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(distinct
    coalesce(e.message_fingerprint, e.message) || ':' || e.event_type
  )
  from public.errors e
  where e.project_id = p_project_id
    and (p_from       is null or e.created_at >= p_from)
    and (p_to         is null or e.created_at <= p_to)
    and (p_event_type is null or e.event_type  = p_event_type)
    and (p_search     is null or e.message     ilike '%' || p_search     || '%')
    and (p_browser    is null or e.browser     ilike '%' || p_browser    || '%')
    and (p_os         is null or e.os          ilike '%' || p_os         || '%')
    and (p_connection is null or e.connection  = p_connection)
    and (p_url        is null or e.url         ilike '%' || p_url        || '%')
    and (e.event_type <> 'vital'
         or e.metadata->>'rating' is null
         or e.metadata->>'rating' <> 'good')
$$;
