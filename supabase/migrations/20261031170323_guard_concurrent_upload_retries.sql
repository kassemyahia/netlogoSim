create or replace function public.begin_submission(
  p_project_id bigint,
  p_filename text,
  p_size bigint,
  p_sha256 text,
  p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer; v_state text; v_stored_filename text; v_created_at timestamptz; v_original_filename text; v_size bigint; v_sha256 text;
begin
  perform 1 from public.projects where id=p_project_id for update;
  if not found then raise exception using errcode='22023', message='project_not_found'; end if;

  select id, version, state, stored_filename, created_at, original_filename, size_bytes, sha256
  into v_id, v_version, v_state, v_stored_filename, v_created_at, v_original_filename, v_size, v_sha256
  from public.project_submissions
  where project_id=p_project_id and request_id=p_request_id;

  if v_id is not null then
    if v_original_filename <> p_filename or v_size <> p_size or v_sha256 <> p_sha256 then
      raise exception using errcode='22023', message='upload_request_payload_changed';
    end if;
    if v_state = 'active' then
      return jsonb_build_object('submissionId',v_id,'version',v_version,'storedFilename',v_stored_filename,'alreadyActive',true,'alreadyInProgress',false);
    end if;
    if v_state = 'uploading' and v_created_at >= now() - interval '3 minutes' then
      return jsonb_build_object('submissionId',v_id,'version',v_version,'storedFilename',v_stored_filename,'alreadyActive',false,'alreadyInProgress',true);
    end if;
    if v_state = 'uploading' then
      update public.project_submissions set created_at=now(),failure_code=null where id=v_id;
      return jsonb_build_object('submissionId',v_id,'version',v_version,'storedFilename',v_stored_filename,'alreadyActive',false,'alreadyInProgress',false);
    end if;
    raise exception using errcode='55000', message='upload_request_failed';
  end if;

  select coalesce(max(version),0)+1 into v_version
  from public.project_submissions where project_id=p_project_id;
  v_stored_filename := p_project_id::text||'-v'||v_version||'.html';
  insert into public.project_submissions(
    project_id,version,original_filename,stored_filename,size_bytes,sha256,state,request_id
  ) values(
    p_project_id,v_version,p_filename,v_stored_filename,p_size,p_sha256,'uploading',p_request_id
  ) returning id into v_id;
  return jsonb_build_object('submissionId',v_id,'version',v_version,'storedFilename',v_stored_filename,'alreadyActive',false,'alreadyInProgress',false);
end $$;

revoke all on function public.begin_submission(bigint,text,bigint,text,uuid) from public, anon, authenticated;
grant execute on function public.begin_submission(bigint,text,bigint,text,uuid) to service_role;
