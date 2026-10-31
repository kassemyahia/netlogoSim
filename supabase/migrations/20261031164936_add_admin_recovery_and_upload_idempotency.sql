-- Docker is not required for this transactional, private pre-change snapshot.
-- The schema is outside the exposed Data API schema and explicitly inaccessible
-- to browser roles. It can be removed by the owner after external backups exist.
create schema if not exists bluebits_backup;
revoke all on schema bluebits_backup from public, anon, authenticated;
create table if not exists bluebits_backup.projects_20261031 as table public.projects;
create table if not exists bluebits_backup.operation_requests_20261031 as table public.operation_requests;
create table if not exists bluebits_backup.project_submissions_20261031 as table public.project_submissions;
create table if not exists bluebits_backup.google_integration_config_20261031 as table public.google_integration_config;
create table if not exists bluebits_backup.sync_outbox_20261031 as table public.sync_outbox;
revoke all on all tables in schema bluebits_backup from public, anon, authenticated;

-- Link deterministic registration request IDs to projects so currently issued
-- codes can be regenerated without storing plaintext codes.
alter table public.operation_requests
  add column if not exists project_id bigint references public.projects(id) on delete cascade;

update public.operation_requests as request
set project_id = (request.response->>'projectId')::bigint
where request.action = 'register'
  and request.project_id is null
  and request.response->>'projectId' ~ '^[1-9][0-9]*$'
  and exists (
    select 1 from public.projects as project
    where project.id = (request.response->>'projectId')::bigint
  );

create index if not exists operation_requests_register_project_idx
  on public.operation_requests(project_id)
  where action = 'register' and project_id is not null;

alter table public.project_submissions
  add column if not exists request_id uuid;
update public.project_submissions set request_id = gen_random_uuid() where request_id is null;
alter table public.project_submissions alter column request_id set default gen_random_uuid();
alter table public.project_submissions alter column request_id set not null;
create unique index if not exists project_submissions_request_idx
  on public.project_submissions(project_id, request_id);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null check (action in ('code_recovered','code_rotated','codes_exported')),
  project_id bigint references public.projects(id) on delete set null,
  ip_hash text not null check (char_length(ip_hash) = 64),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_actor_created_idx
  on public.admin_audit_log(actor_id, created_at desc);
create index if not exists admin_audit_log_project_created_idx
  on public.admin_audit_log(project_id, created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
revoke all on sequence public.admin_audit_log_id_seq from public, anon, authenticated;

create or replace function public.register_project_secure(
  p_request_id uuid, p_grade text, p_subject text, p_unit text, p_page integer,
  p_description text, p_team_label text, p_team_secret_hash text, p_members jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_project_id bigint; v_member jsonb; v_position integer := 0; v_existing jsonb;
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
  insert into public.operation_requests(request_id,action,response,project_id)
  values(p_request_id,'register',v_existing,v_project_id);
  insert into public.sync_outbox(aggregate_type,aggregate_id,event_type) values('project',v_project_id::text,'project_upsert');
  return v_existing;
exception when unique_violation then
  raise exception using errcode='23505', message='reservation_taken';
end $$;

revoke all on function public.begin_submission(bigint,text,bigint,text) from public, anon, authenticated, service_role;
drop function if exists public.begin_submission(bigint,text,bigint,text);

create function public.begin_submission(
  p_project_id bigint,
  p_filename text,
  p_size bigint,
  p_sha256 text,
  p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer; v_state text; v_stored_filename text;
begin
  perform 1 from public.projects where id=p_project_id for update;
  if not found then raise exception using errcode='22023', message='project_not_found'; end if;

  select id, version, state, stored_filename
  into v_id, v_version, v_state, v_stored_filename
  from public.project_submissions
  where project_id=p_project_id and request_id=p_request_id;

  if v_id is not null then
    if v_state not in ('uploading','active') then
      raise exception using errcode='55000', message='upload_request_failed';
    end if;
    return jsonb_build_object(
      'submissionId',v_id,
      'version',v_version,
      'storedFilename',v_stored_filename,
      'alreadyActive',v_state='active'
    );
  end if;

  select coalesce(max(version),0)+1 into v_version
  from public.project_submissions where project_id=p_project_id;
  v_stored_filename := p_project_id::text||'-v'||v_version||'.html';
  insert into public.project_submissions(
    project_id,version,original_filename,stored_filename,size_bytes,sha256,state,request_id
  ) values(
    p_project_id,v_version,p_filename,v_stored_filename,p_size,p_sha256,'uploading',p_request_id
  ) returning id into v_id;
  return jsonb_build_object(
    'submissionId',v_id,
    'version',v_version,
    'storedFilename',v_stored_filename,
    'alreadyActive',false
  );
end $$;

create or replace function public.activate_submission(p_submission_id uuid,p_drive_file_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_project_id bigint; v_state text;
begin
  select project_id,state into v_project_id,v_state
  from public.project_submissions where id=p_submission_id for update;
  if v_state = 'active' then return; end if;
  if v_project_id is null or v_state <> 'uploading' then raise exception 'submission_not_uploading'; end if;
  update public.project_submissions set state='superseded' where project_id=v_project_id and state='active';
  update public.project_submissions set state='active',drive_file_id=p_drive_file_id,activated_at=now() where id=p_submission_id;
  update public.projects set is_submitted=true,updated_at=now() where id=v_project_id;
  insert into public.sync_outbox(aggregate_type,aggregate_id,event_type)
  values('submission',p_submission_id::text,'submission_upsert') on conflict do nothing;
end $$;

create or replace function public.admin_rotate_team_code(
  p_project_id bigint,
  p_new_hash text,
  p_actor_id uuid,
  p_ip_hash text
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.projects
  set team_secret_hash=p_new_hash,legacy_team_code_hash=null,updated_at=now()
  where id=p_project_id;
  if not found then return false; end if;
  insert into public.admin_audit_log(actor_id,action,project_id,ip_hash)
  values(p_actor_id,'code_rotated',p_project_id,p_ip_hash);
  return true;
end $$;

revoke all on function public.register_project_secure(uuid,text,text,text,integer,text,text,text,jsonb),
  public.begin_submission(bigint,text,bigint,text,uuid),
  public.activate_submission(uuid,text),
  public.admin_rotate_team_code(bigint,text,uuid,text)
from public, anon, authenticated;
grant execute on function public.register_project_secure(uuid,text,text,text,integer,text,text,text,jsonb),
  public.begin_submission(bigint,text,bigint,text,uuid),
  public.activate_submission(uuid,text),
  public.admin_rotate_team_code(bigint,text,uuid,text)
to service_role;

-- Point the existing encrypted Google authorization at the owner-confirmed
-- private resources. This changes no sharing permissions and no OAuth tokens.
insert into public.google_integration_config(
  singleton,submissions_folder_id,spreadsheet_id,updated_at
) values (
  true,
  '1YoII5_6-PCllZn0-89tltNvnll7Dp7Bl',
  '191A_WBzmseYhiURRCv4GOOYbT55oBLJIDthp0NO_F0I',
  now()
)
on conflict (singleton) do update
set submissions_folder_id=excluded.submissions_folder_id,
    spreadsheet_id=excluded.spreadsheet_id,
    updated_at=excluded.updated_at;

-- Requeue the stable project mirror rows so the new Team Members column is
-- populated for existing projects without creating duplicate row mappings.
insert into public.sync_outbox(
  aggregate_type,aggregate_id,event_type,status,available_at,attempts,last_error_code,last_error_at,completed_at
)
select 'project',id::text,'project_upsert','retry',now(),0,null,null,null
from public.projects
on conflict (aggregate_type,aggregate_id,event_type) do update
set status='retry',available_at=now(),attempts=0,last_error_code=null,last_error_at=null,completed_at=null;
