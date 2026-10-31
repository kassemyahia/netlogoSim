-- The legacy schema required a public-facing JSON member document on every
-- project. New registrations store members only in the RLS-protected
-- project_members table, so this compatibility column must allow NULL.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'team_members_json'
  ) then
    alter table public.projects alter column team_members_json drop not null;
  end if;
end
$$;
