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

-- ============================================================
-- SESSION RECORDINGS (for session replay feature)
-- ============================================================

-- Stores metadata for rrweb recordings uploaded to S3.
-- The actual events are stored in S3 (key = s3_key).
-- Configure an S3 lifecycle rule to delete objects after 7 days:
--   Prefix: recordings/   Expiration: 7 days
create table if not exists session_recordings (
  id         uuid primary key,                        -- set by SDK (matches session_recording_id on errors)
  project_id uuid references projects(id) on delete cascade not null,
  session_id text not null,
  s3_key     text not null,
  duration_ms integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists session_recordings_project_session
  on session_recordings(project_id, session_id);

alter table session_recordings enable row level security;

create policy "Project owners can manage session recordings"
  on session_recordings for all
  using (get_project_owner(session_recordings.project_id) = auth.uid());

create policy "Members can view session recordings"
  on session_recordings for select
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = session_recordings.project_id
        and project_members.user_id = auth.uid()
        and project_members.status = 'accepted'
    )
  );

-- Link errors to their session recording (nullable — only set when sessionReplay is enabled)
-- No FK constraint: recording upload is async and may arrive after the error row
alter table errors add column if not exists session_recording_id uuid;

-- Index for fast project error feeds sorted by time
create index if not exists errors_project_id_created_at
  on errors(project_id, created_at desc);

-- GitHub OAuth connection (one per user — shared across all their projects)
create table if not exists github_user_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  access_token text not null,  -- AES-256-GCM encrypted
  github_username text not null default '',
  created_at timestamptz not null default now()
);

-- GitHub repo selection (one per project — no token stored here)
create table if not exists github_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null unique,
  repo_owner text not null default '',
  repo_name text not null default '',
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

-- Ingest filters — events matching these fingerprints are dropped at ingest time
create table if not exists ingest_filters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  fingerprint text not null,           -- normalized message fingerprint
  message text not null,               -- original message, for display
  event_type text,                     -- null = match all event types
  note text,                           -- optional human label
  created_at timestamptz not null default now(),
  unique (project_id, fingerprint, event_type)
);

create index if not exists ingest_filters_project_id
  on ingest_filters(project_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table projects enable row level security;
alter table errors enable row level security;
alter table github_user_connections enable row level security;
alter table github_connections enable row level security;
alter table fix_suggestions enable row level security;
alter table ingest_filters enable row level security;

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

-- github_user_connections: each user manages their own
create policy "Users can manage own github connection"
  on github_user_connections for all
  using (auth.uid() = user_id);

-- github_connections: project owner manages repo selection; members can read
create policy "Project owners can manage github repo selection"
  on github_connections for all
  using (
    exists (
      select 1 from projects
      where projects.id = github_connections.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "Members can view github repo selection"
  on github_connections for select
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = github_connections.project_id
        and project_members.user_id = auth.uid()
        and project_members.status = 'accepted'
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

-- Security definer function to check project ownership without triggering RLS recursion
-- (avoids infinite loop: projects policy → project_members → projects policy)
create or replace function get_project_owner(project_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select user_id from projects where id = project_id;
$$;

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
-- Uses security definer function to avoid RLS recursion with projects table
create policy "Project owners can manage members"
  on project_members for all
  using (get_project_owner(project_members.project_id) = auth.uid());

-- Members can see their own invite rows
create policy "Members can view own membership"
  on project_members for select
  using (
    auth.uid() = user_id
    or invited_email = auth.email()
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

-- ingest_filters: owners can manage, accepted members can read
create policy "Owners can manage ingest filters"
  on ingest_filters for all
  using (get_project_owner(ingest_filters.project_id) = auth.uid());

create policy "Members can view ingest filters"
  on ingest_filters for select
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = ingest_filters.project_id
        and project_members.user_id = auth.uid()
        and project_members.status = 'accepted'
    )
  );

-- ============================================================
-- MIGRATION: Per-project → per-user GitHub connections
-- Run this if you have an existing deployment with the old schema
-- ============================================================
-- -- 1. Create the new user-level table
-- create table if not exists github_user_connections (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid references auth.users(id) on delete cascade not null unique,
--   access_token text not null,
--   github_username text not null default '',
--   created_at timestamptz not null default now()
-- );
-- alter table github_user_connections enable row level security;
-- create policy "Users can manage own github connection"
--   on github_user_connections for all using (auth.uid() = user_id);
--
-- -- 2. Migrate tokens from old per-project rows to the new table
-- insert into github_user_connections (user_id, access_token, created_at)
-- select distinct on (p.user_id) p.user_id, gc.access_token, gc.created_at
-- from github_connections gc
-- join projects p on gc.project_id = p.id
-- where gc.access_token is not null
-- order by p.user_id, gc.created_at desc
-- on conflict (user_id) do nothing;
--
-- -- 3. Drop access_token from github_connections
-- alter table github_connections drop column if exists access_token;

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
