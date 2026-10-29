# Production migration and legacy data

No production credentials were available while this migration was authored. The migration assumes the existing base table is `public.projects`, `public.public_projects` is a view, legacy members are in `team_members_json`, legacy secrets are in `team_code`, and legacy file columns are `file_url` / `file_name`. Inspect the live schema and a backup before applying:

```bash
supabase db dump --linked --schema public --file pre_secure_portal.sql
supabase db diff --linked
supabase db push --dry-run
```

If `public_projects` is a table rather than a view, stop and adapt the migration; the included `DROP VIEW` intentionally fails instead of deleting a table. Do not apply blindly. The migration does not delete projects or files and does not rewrite history.

## Data transition

1. The migration copies valid legacy `team_members_json` rows into private `project_members` and replaces the public view with non-sensitive columns.
2. Plaintext legacy team codes are SHA-256 hashed into `legacy_team_code_hash`, the plaintext column is nulled, and the old browser RPCs lose execute grants. In each project's upload/download dialog, “update old short code” performs a rate-limited one-time exchange for a new 256-bit code; the legacy digest is then removed.
3. Legacy public URLs are copied into private migration columns and marked `pending`. Deploy and invoke `legacy-migration` from a trusted terminal until `examined` is zero:

   ```bash
   curl -sS -X POST \
     -H "x-worker-secret: YOUR_MIGRATION_WORKER_SECRET" \
     https://YOUR_PROJECT_REF.supabase.co/functions/v1/legacy-migration
   ```

4. The worker downloads each existing object, validates that it is bounded structured HTML, uploads a server-generated name to the private Drive folder, records checksum/version metadata, and only then activates it. A failed item remains visible as `failed`; the prior URL is retained. A Drive file created before a database failure is deleted or marked `cleanup_pending` for reconciliation.
5. Compare counts and manually download samples as their owning teams/admin before changing Storage:

   ```sql
   select legacy_migration_status, count(*) from public.projects group by 1;
   select state, count(*) from public.project_submissions group by 1;
   ```

6. Merely hiding a URL in the database does **not** revoke an already-public Supabase Storage URL. After all rows are verified and backed up, separately make `project-files` private and remove obsolete public read policies. Deleting old Storage objects is destructive and is intentionally not automated; do it only after explicit owner approval and a retention decision.

Non-HTML legacy files are preserved at their old location and marked failed; they are not silently converted, deleted, or described as private. Contact those teams for a fresh `.html` export.

## Local verification

With Docker running:

```bash
supabase start
supabase db reset
supabase test db
deno test --allow-env supabase/functions/tests
```

Use mock or dedicated Google resources for end-to-end tests. Never run test registrations against production.
