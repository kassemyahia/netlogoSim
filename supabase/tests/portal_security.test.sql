begin;
select plan(17);

select ok(has_table_privilege('anon','public.public_projects','select'), 'anonymous can read public view');
select ok(not has_table_privilege('anon','public.project_members','select'), 'anonymous cannot read members');
select ok(not has_table_privilege('anon','public.project_submissions','select'), 'anonymous cannot read submissions');
select ok(not has_table_privilege('anon','public.projects','insert'), 'anonymous cannot reserve directly');
select ok(not has_table_privilege('authenticated','public.projects','update'), 'authenticated cannot bypass API');
select ok(not has_function_privilege('anon','public.register_project_secure(uuid,text,text,text,integer,text,text,text,jsonb)','execute'), 'anonymous cannot call secure registration RPC');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('register_project','upload_team_project_file') and has_function_privilege('anon',p.oid,'execute')), 'legacy RPCs are absent or not executable');

set local role service_role;
insert into public.projects(id,grade,subject,unit,page,idea_description,team_label,team_secret_hash)
values ('10000000-0000-0000-0000-000000000001','الصف السابع','الرياضيات','واحد',901,'اختبار','فريق اختبار','correct-hash');

select ok(public.authorize_team('10000000-0000-0000-0000-000000000001','correct-hash'), 'matching team hash is authorized');
select ok(not public.authorize_team('10000000-0000-0000-0000-000000000001','wrong-hash'), 'wrong team hash is denied before upload');
insert into public.projects(id,grade,subject,unit,page,idea_description,team_label,team_secret_hash)
values ('10000000-0000-0000-0000-000000000002','الصف السابع','العلوم','واحد',902,'اختبار','فريق ثان','second-hash');
select ok(not public.authorize_team('10000000-0000-0000-0000-000000000002','correct-hash'), 'one team secret cannot access another team');
select throws_ok($$insert into public.projects(grade,subject,unit,page,idea_description,team_label,team_secret_hash) values ('الصف السابع','الرياضيات','اثنان',901,'تعارض','فريق آخر','hash')$$,'23505',null,'reservation uniqueness survives concurrent races');
select throws_ok($$insert into public.project_members(project_id,position,name,university_id) values ('10000000-0000-0000-0000-000000000001',1,'أ','001'),('10000000-0000-0000-0000-000000000001',2,'ب','001')$$,'23505',null,'duplicate university IDs in a team are rejected');
select ok(exists(select 1 from pg_indexes where indexname='one_active_submission_per_project'), 'only one active file version is allowed');
select ok(exists(select 1 from pg_indexes where indexname='sync_outbox_work_idx'), 'outbox worker index exists');
insert into public.project_submissions(id,project_id,version,drive_file_id,original_filename,stored_filename,size_bytes,sha256,state,activated_at)
values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'old-drive','old.html','old-v1.html',10,repeat('a',64),'active',now()),
       ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',2,null,'new.html','new-v2.html',20,repeat('b',64),'uploading',null);
select is((select state from public.project_submissions where id='20000000-0000-0000-0000-000000000001'),'active','previous version remains active while replacement uploads');
select public.activate_submission('20000000-0000-0000-0000-000000000002','new-drive');
select is((select state from public.project_submissions where id='20000000-0000-0000-0000-000000000001'),'superseded','old version supersedes only after commit');
select is((select state from public.project_submissions where id='20000000-0000-0000-0000-000000000002'),'active','replacement activates atomically');

select * from finish();
rollback;
