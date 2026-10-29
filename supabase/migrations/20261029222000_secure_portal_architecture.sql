-- Assumptions: the legacy writable relation is public.projects and public.public_projects
-- is a view. Inspect production before applying; see docs/MIGRATION.md.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  grade text not null,
  subject text not null,
  unit text not null,
  page integer not null,
  idea_description text not null,
  team_label text not null,
  team_secret_hash text not null,
  is_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_grade_check check (grade in ('الصف السابع','الصف الثامن','الصف التاسع')),
  constraint projects_subject_check check (subject in ('الرياضيات','العلوم','الفيزياء والكيمياء')),
  constraint projects_page_check check (page between 1 and 10000),
  constraint projects_unit_check check (char_length(btrim(unit)) between 1 and 160),
  constraint projects_description_check check (char_length(btrim(idea_description)) between 1 and 2000),
  constraint projects_team_label_check check (char_length(btrim(team_label)) between 1 and 80)
);

-- Add secure columns without rewriting or deleting legacy records.
alter table public.projects add column if not exists team_label text;
alter table public.projects add column if not exists team_secret_hash text;
alter table public.projects add column if not exists legacy_team_code_hash text;
alter table public.projects add column if not exists is_submitted boolean not null default false;
alter table public.projects add column if not exists created_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.projects add column if not exists legacy_file_url text;
alter table public.projects add column if not exists legacy_file_name text;
alter table public.projects add column if not exists legacy_migration_status text check (legacy_migration_status in ('pending','migrated','failed'));
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='file_url') then
    execute 'update public.projects set legacy_file_url=file_url where legacy_file_url is null and nullif(file_url,'''') is not null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='file_name') then
    execute 'update public.projects set legacy_file_name=file_name where legacy_file_name is null and nullif(file_name,'''') is not null';
  end if;
  update public.projects set legacy_migration_status='pending' where legacy_file_url is not null and legacy_migration_status is null;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='team_code') then
    execute 'alter table public.projects alter column team_code drop not null';
    execute 'update public.projects set legacy_team_code_hash=encode(extensions.digest(team_code,''sha256''),''hex''), team_code=null where nullif(team_code,'''') is not null and team_secret_hash is null';
  end if;
end $$;

create unique index if not exists projects_reservation_unique on public.projects (grade, subject, page);
create index if not exists projects_grade_page_idx on public.projects (grade, page);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position smallint not null check (position between 1 and 8),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  university_id text not null check (char_length(btrim(university_id)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (project_id, position),
  unique (project_id, university_id)
);
create index if not exists project_members_project_idx on public.project_members(project_id);
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='team_members_json') then
    execute $copy$
      insert into public.project_members(project_id,position,name,university_id)
      select p.id, m.ordinality::smallint, btrim(m.value->>'name'), btrim(m.value->>'collegeId')
      from public.projects p cross join lateral jsonb_array_elements(p.team_members_json) with ordinality m(value,ordinality)
      where jsonb_typeof(p.team_members_json)='array' and nullif(btrim(m.value->>'name'),'') is not null and nullif(btrim(m.value->>'collegeId'),'') is not null
      on conflict do nothing
    $copy$;
  end if;
  update public.projects set team_label='فريق مسجل '||substr(id::text,1,6) where team_label is null;
end $$;

create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null check (version > 0),
  drive_file_id text,
  original_filename text not null,
  stored_filename text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('uploading','active','superseded','cleanup_pending','failed')),
  failure_code text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique(project_id, version)
);
create unique index if not exists one_active_submission_per_project on public.project_submissions(project_id) where state = 'active';
create index if not exists submissions_cleanup_idx on public.project_submissions(state, created_at) where state in ('uploading','cleanup_pending','failed');

create table if not exists public.sync_outbox (
  id bigint generated always as identity primary key,
  aggregate_type text not null check (aggregate_type in ('project','submission')),
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','retry','completed','dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by uuid,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(aggregate_type, aggregate_id, event_type)
);
create index if not exists sync_outbox_work_idx on public.sync_outbox(available_at, id) where status in ('pending','retry');

create table if not exists public.api_rate_limits (
  scope text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key(scope, subject_hash, window_start)
);
create index if not exists api_rate_limits_cleanup_idx on public.api_rate_limits(window_start);

create table if not exists public.operation_requests (
  request_id uuid primary key,
  action text not null,
  response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.google_oauth_credentials (
  singleton boolean primary key default true check (singleton),
  encrypted_refresh_token text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.google_integration_config (
  singleton boolean primary key default true check (singleton),
  submissions_folder_id text not null,
  spreadsheet_id text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.sheet_row_map (
  row_number bigint generated always as identity primary key,
  tab_name text not null check (tab_name in ('Projects','Members')),
  entity_key text not null,
  created_at timestamptz not null default now(),
  unique(tab_name, entity_key)
);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_submissions enable row level security;
alter table public.sync_outbox enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.operation_requests enable row level security;
alter table public.google_oauth_credentials enable row level security;
alter table public.google_integration_config enable row level security;
alter table public.sheet_row_map enable row level security;

revoke all on public.projects, public.project_members, public.project_submissions, public.sync_outbox, public.api_rate_limits, public.operation_requests from anon, authenticated;
revoke all on public.google_oauth_credentials, public.google_integration_config from anon, authenticated;
revoke all on public.sheet_row_map from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

drop view if exists public.public_projects;
create view public.public_projects
with (security_invoker = true)
as select id, grade, subject, unit, page, idea_description,
  coalesce(team_label, 'فريق مسجل') as team_label, is_submitted, created_at
from public.projects;
grant select on public.public_projects to anon, authenticated;
grant select on public.projects to anon, authenticated;
create policy "public reservation fields through view only" on public.projects for select to anon, authenticated using (true);

-- The base-table grant is required by a security-invoker view. Column privileges keep
-- sensitive columns inaccessible even if a client queries projects directly.
revoke select on public.projects from anon, authenticated;
grant select (id, grade, subject, unit, page, idea_description, team_label, is_submitted, created_at) on public.projects to anon, authenticated;

create or replace function public.check_rate_limit(p_scope text, p_subject_hash text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_window timestamptz := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
declare v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then return false; end if;
  insert into public.api_rate_limits(scope, subject_hash, window_start, hits)
  values (p_scope, p_subject_hash, v_window, 1)
  on conflict(scope, subject_hash, window_start) do update set hits = public.api_rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

create or replace function public.register_project_secure(
  p_request_id uuid, p_grade text, p_subject text, p_unit text, p_page integer,
  p_description text, p_team_label text, p_team_secret_hash text, p_members jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_project_id uuid; v_member jsonb; v_position integer := 0; v_existing jsonb;
begin
  select response into v_existing from public.operation_requests where request_id = p_request_id;
  if v_existing is not null then return v_existing; end if;
  if p_grade not in ('الصف السابع','الصف الثامن','الصف التاسع') or p_subject not in ('الرياضيات','العلوم','الفيزياء والكيمياء') then raise exception using errcode='22023', message='invalid_catalog_value'; end if;
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) not between 4 and 8 then raise exception using errcode='22023', message='invalid_team_size'; end if;
  insert into public.projects(grade,subject,unit,page,idea_description,team_label,team_secret_hash)
  values(p_grade,p_subject,btrim(p_unit),p_page,btrim(p_description),btrim(p_team_label),p_team_secret_hash) returning id into v_project_id;
  for v_member in select value from jsonb_array_elements(p_members) loop
    v_position := v_position + 1;
    insert into public.project_members(project_id,position,name,university_id)
    values(v_project_id,v_position,btrim(v_member->>'name'),btrim(v_member->>'collegeId'));
  end loop;
  v_existing := jsonb_build_object('projectId',v_project_id);
  insert into public.operation_requests(request_id,action,response) values(p_request_id,'register',v_existing);
  insert into public.sync_outbox(aggregate_type,aggregate_id,event_type) values('project',v_project_id,'project_upsert');
  return v_existing;
exception when unique_violation then
  raise exception using errcode='23505', message='reservation_taken';
end $$;

create or replace function public.authorize_team(p_project_id uuid, p_hash text)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists(select 1 from public.projects where id=p_project_id and team_secret_hash=p_hash)
$$;

create or replace function public.rotate_legacy_team_code(p_project_id uuid,p_legacy_hash text,p_new_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.projects set team_secret_hash=p_new_hash,legacy_team_code_hash=null,updated_at=now()
  where id=p_project_id and team_secret_hash is null and legacy_team_code_hash=p_legacy_hash;
  return found;
end $$;

create or replace function public.begin_submission(p_project_id uuid,p_filename text,p_size bigint,p_sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer;
begin
  perform 1 from public.projects where id=p_project_id for update;
  select coalesce(max(version),0)+1 into v_version from public.project_submissions where project_id=p_project_id;
  insert into public.project_submissions(project_id,version,original_filename,stored_filename,size_bytes,sha256,state)
  values(p_project_id,v_version,p_filename,p_project_id::text||'-v'||v_version||'.html',p_size,p_sha256,'uploading') returning id into v_id;
  return jsonb_build_object('submissionId',v_id,'version',v_version,'storedFilename',p_project_id::text||'-v'||v_version||'.html');
end $$;

create or replace function public.activate_submission(p_submission_id uuid,p_drive_file_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_project_id uuid;
begin
  select project_id into v_project_id from public.project_submissions where id=p_submission_id and state='uploading' for update;
  if v_project_id is null then raise exception 'submission_not_uploading'; end if;
  update public.project_submissions set state='superseded' where project_id=v_project_id and state='active';
  update public.project_submissions set state='active',drive_file_id=p_drive_file_id,activated_at=now() where id=p_submission_id;
  update public.projects set is_submitted=true,updated_at=now() where id=v_project_id;
  insert into public.sync_outbox(aggregate_type,aggregate_id,event_type) values('submission',p_submission_id,'submission_upsert') on conflict do nothing;
end $$;

create or replace function public.claim_sync_jobs(p_worker uuid,p_limit integer default 20)
returns setof public.sync_outbox language plpgsql security definer set search_path = '' as $$
begin
  update public.sync_outbox set status='retry',locked_at=null,locked_by=null,available_at=now(),last_error_code='stale_worker_lock',last_error_at=now()
  where status='processing' and locked_at < now() - interval '10 minutes';
  return query update public.sync_outbox o set status='processing',locked_at=now(),locked_by=p_worker,attempts=attempts+1
  where o.id in (select id from public.sync_outbox where status in ('pending','retry') and available_at<=now() order by available_at,id for update skip locked limit least(p_limit,100)) returning o.*;
end $$;

revoke all on function public.check_rate_limit(text,text,integer,integer), public.register_project_secure(uuid,text,text,text,integer,text,text,text,jsonb), public.authorize_team(uuid,text), public.rotate_legacy_team_code(uuid,text,text), public.begin_submission(uuid,text,bigint,text), public.activate_submission(uuid,text), public.claim_sync_jobs(uuid,integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text,text,integer,integer), public.register_project_secure(uuid,text,text,text,integer,text,text,text,jsonb), public.authorize_team(uuid,text), public.rotate_legacy_team_code(uuid,text,text), public.begin_submission(uuid,text,bigint,text), public.activate_submission(uuid,text), public.claim_sync_jobs(uuid,integer) to service_role;

-- Lock legacy RPC entry points if they exist. Dropping is intentionally deferred until
-- signatures are inspected; removing anon/authenticated execute blocks browser bypass.
do $$ declare r record; begin
  for r in select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('register_project','upload_team_project_file') loop
    execute format('revoke all on function %I.%I(%s) from public, anon, authenticated',r.nspname,r.proname,r.args);
  end loop;
end $$;
