-- The Edge Function is now the only write path. These legacy SECURITY DEFINER
-- RPCs exposed plaintext codes, public file URLs, and a hard-coded admin code.
drop function if exists public.register_project(text,text,text,text,integer,text,text,text);
drop function if exists public.register_project(jsonb,text,text,text,integer,text,text,text);
drop function if exists public.upload_team_project_file(bigint,text,text,text);
drop function if exists public.generate_team_code();

-- This pre-existing event-trigger helper is not an application RPC. Event
-- triggers do not require anonymous users to have EXECUTE on the function.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Keep the existing UNIQUE constraint and its backing index. The first secure
-- migration's compatibility index is redundant on this production schema.
drop index if exists public.projects_reservation_unique;
