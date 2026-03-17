-- Ultron Error Tracker — Supabase Schema
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends auth.users — auto-created via trigger)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- Projects (one user can have many projects)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  api_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Errors ingested from the npm SDK
create table if not exists errors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  event_type text not null default 'error', -- 'error' | 'network' | 'vital' | 'resource_error'
  message text not null,
  stack_trace text,
  url text,
  browser text,
  os text,
  viewport text,    -- "width:height:pixelRatio"
  connection text,  -- "4g", "wifi", "unknown"
  session_id text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Migration: run this if you already created the table without event_type/viewport/connection
-- alter table errors add column if not exists event_type text not null default 'error';
-- alter table errors add column if not exists viewport text;
-- alter table errors add column if not exists connection text;

-- Index for fast project error feeds sorted by time
create index if not exists errors_project_id_created_at
  on errors(project_id, created_at desc);

-- GitHub repo connections (one per project)
create table if not exists github_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null unique,
  repo_owner text not null default '',
  repo_name text not null default '',
  access_token text not null,  -- AES-256-GCM encrypted
  created_at timestamptz not null default now()
);

-- AI fix suggestions
create table if not exists fix_suggestions (
  id uuid primary key default gen_random_uuid(),
  error_id uuid references errors(id) on delete cascade not null,
  suggestion text not null,
  relevant_files jsonb default '[]',
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table projects enable row level security;
alter table errors enable row level security;
alter table github_connections enable row level security;
alter table fix_suggestions enable row level security;

-- profiles: each user manages their own profile
create policy "Users can manage own profile"
  on profiles for all
  using (auth.uid() = id);

-- projects: owner only
create policy "Users can manage own projects"
  on projects for all
  using (auth.uid() = user_id);

-- errors: project owner can read/write
create policy "Project owners can manage errors"
  on errors for all
  using (
    exists (
      select 1 from projects
      where projects.id = errors.project_id
        and projects.user_id = auth.uid()
    )
  );

-- github_connections: project owner
create policy "Project owners can manage github connections"
  on github_connections for all
  using (
    exists (
      select 1 from projects
      where projects.id = github_connections.project_id
        and projects.user_id = auth.uid()
    )
  );

-- fix_suggestions: through error → project → owner
create policy "Project owners can manage fix suggestions"
  on fix_suggestions for all
  using (
    exists (
      select 1 from errors e
      join projects p on p.id = e.project_id
      where e.id = fix_suggestions.error_id
        and p.user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles(id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure handle_new_user();

-- ============================================================
-- PROJECT MEMBERS (collaborators / invites)
-- ============================================================

create table if not exists project_members (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade not null,
  invited_email text not null,
  user_id       uuid references auth.users(id) on delete set null,
  role          text not null default 'member',
  status        text not null default 'pending',   -- 'pending' | 'accepted'
  token         text not null unique,              -- secure random invite link token
  invited_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  unique(project_id, invited_email)
);

alter table project_members enable row level security;

-- Owner can do everything with their project's members
create policy "Project owners can manage members"
  on project_members for all
  using (
    exists (
      select 1 from projects
      where projects.id = project_members.project_id
        and projects.user_id = auth.uid()
    )
  );

-- Members can see their own invite rows
create policy "Members can view own membership"
  on project_members for select
  using (
    auth.uid() = user_id
    or invited_email = (select email from auth.users where id = auth.uid())
  );

-- projects: members can read projects they've accepted
create policy "Members can view shared projects"
  on projects for select
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = projects.id
        and project_members.user_id = auth.uid()
        and project_members.status = 'accepted'
    )
  );

-- errors: accepted members can read
create policy "Members can view project errors"
  on errors for select
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = errors.project_id
        and project_members.user_id = auth.uid()
        and project_members.status = 'accepted'
    )
  );

-- fix_suggestions: accepted members can read
create policy "Members can view fix suggestions"
  on fix_suggestions for select
  using (
    exists (
      select 1 from errors e
      join project_members pm on pm.project_id = e.project_id
      where e.id = fix_suggestions.error_id
        and pm.user_id = auth.uid()
        and pm.status = 'accepted'
    )
  );

-- ============================================================
-- FUTURE: Usage tracking table (for plan gating — not active)
-- ============================================================
-- create table usage (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid references auth.users(id),
--   month text not null,
--   errors_ingested integer default 0,
--   fix_suggestions_used integer default 0
-- );
