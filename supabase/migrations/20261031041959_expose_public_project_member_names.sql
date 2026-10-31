-- Student names are intentionally public project metadata. University IDs remain private.
drop policy if exists "public member names are readable" on public.project_members;
create policy "public member names are readable"
on public.project_members for select
to anon, authenticated
using (true);

revoke select on public.project_members from anon, authenticated;
grant select (project_id, position, name) on public.project_members to anon, authenticated;

create or replace view public.public_projects
with (security_invoker = true)
as
select
  p.id,
  p.grade,
  p.subject,
  p.unit,
  p.page,
  p.idea_description,
  coalesce(p.team_label, 'فريق مسجل') as team_label,
  p.is_submitted,
  p.created_at,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('position', pm.position, 'name', pm.name)
        order by pm.position
      )
      from public.project_members as pm
      where pm.project_id = p.id
    ),
    '[]'::jsonb
  ) as members
from public.projects as p;

grant select on public.public_projects to anon, authenticated;
