-- Releases + error regression detection
-- Mirrors the block added to supabase/schema.sql

alter table errors add column if not exists message_fingerprint text;
alter table errors add column if not exists release_version text;

create index if not exists errors_project_type_fingerprint
  on errors(project_id, message_fingerprint) where message_fingerprint is not null;

create table if not exists releases (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade not null,
  version     text not null,
  deployed_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique(project_id, version)
);

create index if not exists releases_project_recent
  on releases(project_id, deployed_at desc);

alter table releases enable row level security;

drop policy if exists "Project owners can manage releases" on releases;
create policy "Project owners can manage releases"
  on releases for all
  using (get_project_owner(releases.project_id) = auth.uid());

drop policy if exists "Members can view releases" on releases;
create policy "Members can view releases"
  on releases for select
  using (
    exists (
      select 1 from project_members
      where project_members.project_id = releases.project_id
        and project_members.user_id = auth.uid()
        and project_members.status = 'accepted'
    )
  );
