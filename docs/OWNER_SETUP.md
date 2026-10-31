# Owner setup

## 1. Supabase project and database

Install the current Supabase CLI, link the intended project, inspect the production schema as described in `MIGRATION.md`, and then apply migrations:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
supabase test db
```

Deploy all functions after the migration succeeds:

```bash
supabase functions deploy project-api
supabase functions deploy google-owner
supabase functions deploy sheets-worker
supabase functions deploy legacy-migration
```

Generate every server secret independently (for example, `openssl rand -base64 48`). Copy `supabase/.env.example` to an ignored file, fill it, and set secrets:

```bash
supabase secrets set --env-file supabase/.env.production
```

`ALLOWED_ORIGINS` should contain the exact production origin `https://locallost.me` and the local Vite origin only when needed. CORS is not authentication; database grants, team-code verification, and server-side admin claims are the controls.

Set `MAX_PREVIEW_BYTES` to the same value as `MAX_HTML_BYTES` unless previews need a lower ceiling. The current production value is 25 MiB (`26214400`).

If Cloudflare Turnstile is used, put the secret in `TURNSTILE_SECRET_KEY` and render its widget in the registration form using a public `VITE_TURNSTILE_SITE_KEY`. If the server secret is set, the backend rejects missing/invalid tokens. Do not enable the secret until the widget is configured.

## 2. Google Cloud and owner authorization

1. Create or select a Google Cloud project.
2. Enable **Google Drive API** and **Google Sheets API**.
3. Configure the OAuth consent screen. For a personal account, choose External. While the app is in Testing, add the owner as a test user. Testing-mode refresh tokens can expire after seven days; move the consent screen to Production when ready and complete any verification Google requires.
4. Create a Web application OAuth client. Add exactly `https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-owner` as an authorized redirect URI.
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the same `GOOGLE_REDIRECT_URI` as Supabase secrets.
6. Start one-time authorization from a trusted terminal. The owner secret is never put in a URL:

   ```bash
   curl -sS -X POST \
     -H "x-owner-setup-secret: YOUR_OWNER_SETUP_SECRET" \
     https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-owner
   ```

7. Open the returned `authorizationUrl`, sign in as the Drive owner, and consent. The callback encrypts the offline refresh token before storing it in an RLS-locked table. Students never authorize Google.

Production is already authorized. Do **not** repeat OAuth or recreate resources for this deployment. Migration `20261031164936` points the existing authorization to the confirmed private folder `1YoII5_6-PCllZn0-89tltNvnll7Dp7Bl` and spreadsheet `191A_WBzmseYhiURRCv4GOOYbT55oBLJIDthp0NO_F0I` without changing sharing permissions.

The integration requests `drive.file` and `spreadsheets`, not full Drive access. `drive.file` covers resources created by this app. An arbitrary existing folder ID does not grant access. This setup intentionally creates the private folder and spreadsheet through the authorized app, avoiding service-account ownership/quota assumptions. If authorization is revoked or expires, requests return an explicit reauthorization error; run the flow again. The private submissions folder and spreadsheet must never be shared publicly.

## 3. Textbooks

Upload the eleven textbooks manually to a **separate** Drive location. Grades 8 and 9 each have separate algebra and geometry books. For each file, set General access to “Anyone with the link — Viewer” (or use a domain-viewer policy if all students are in one Workspace domain). Copy only the Drive file ID from `/file/d/FILE_ID/view` into the matching frontend variable in `.env.example`:

| Variable | Book |
|---|---|
| `VITE_BOOK_G7_MATH_ID` | Grade 7 mathematics |
| `VITE_BOOK_G7_SCIENCE_ID` | Grade 7 science |
| `VITE_BOOK_G7_PHYSICS_ID` | Grade 7 physics/chemistry |
| `VITE_BOOK_G8_ALGEBRA_ID` | Grade 8 algebra |
| `VITE_BOOK_G8_GEOMETRY_ID` | Grade 8 geometry |
| `VITE_BOOK_G8_SCIENCE_ID` | Grade 8 science |
| `VITE_BOOK_G8_PHYSICS_ID` | Grade 8 physics/chemistry |
| `VITE_BOOK_G9_ALGEBRA_ID` | Grade 9 algebra |
| `VITE_BOOK_G9_GEOMETRY_ID` | Grade 9 geometry |
| `VITE_BOOK_G9_SCIENCE_ID` | Grade 9 science |
| `VITE_BOOK_G9_PHYSICS_ID` | Grade 9 physics/chemistry |

The single mapping source is `src/config/books.js`. Invalid or blank IDs render an unavailable state. “Open/download” uses Drive's supported export URL, but Drive may show a confirmation/view page for large or scanned files; forced download is not guaranteed. Textbook sharing has no effect on the private submission folder or spreadsheet.

## 4. Sheets scheduler and recovery

Open `supabase/setup/schedule_worker.sql`, replace its two placeholders, and run it once in the SQL editor. It stores the endpoint and worker secret in Vault and invokes `sheets-worker` every two minutes through `pg_cron`/`pg_net`. Supabase remains authoritative during any Google outage. Jobs use `FOR UPDATE SKIP LOCKED`, bounded exponential retry (maximum eight attempts), deterministic sheet rows, and RAW writes. Dead jobs retain an actionable redacted code in `sync_outbox`.

Queue a full reconciliation/backfill after initial setup or repair:

```bash
curl -sS -X POST \
  -H 'content-type: application/json' \
  -H "x-worker-secret: YOUR_SYNC_WORKER_SECRET" \
  -d '{"action":"backfill"}' \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/sheets-worker
```

Inspect recoverability without exposing student data:

```sql
select status, count(*), max(last_error_code) as example_error
from public.sync_outbox group by status order by status;
```

The spreadsheet has `Projects` and `Members` tabs, immutable IDs, registration/update times, submission state, and private file metadata. `Projects!O:O` is `Team Members`, containing ordered names separated by ` • `. The individual records, including university IDs, remain in `Members`. It excludes codes, hashes, credentials, and Drive IDs. Editing Sheets never changes Supabase.

## 5. Admin authorization

The `/admin` route is useful only after the backend verifies a Supabase user whose server-controlled `app_metadata.role` is `admin` (or `app_metadata.admin` is true). Create/sign in the owner account in Supabase Auth, then set app metadata from a trusted SQL Editor session (replace the email exactly):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'OWNER_EMAIL@example.com';
```

Sign out and sign in again so the JWT contains the new claim. Never use `user_metadata` for authorization. The owner page can search projects/students, recover a still-derivable code, rotate an irrecoverable code, and export recoverable codes only within ten minutes of a real sign-in. Recovery/rotation/export responses are `no-store`; codes are held only in page memory and are never synchronized to Sheets. Every sensitive operation is rate-limited and added to the private `admin_audit_log` without the code value.

Codes issued by secure registration are recoverable only while the corresponding private request ID exists and the current stored hash still matches the deterministic derivation. A legacy hash or a code that was already rotated cannot be reversed; use the owner-only rotation button. Rotation invalidates the prior code immediately.

## 6. GitHub Pages

Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key) as Actions secrets. The eleven non-secret public textbook IDs are repository **variables**, already wired as `vars.*` in the workflow; `src/config/books.js` also contains the verified public defaults. The workflow uses Node 22, `npm ci`, lint, Deno tests/type checks, browser tests, and a production build. HashRouter and `base: './'` are retained, so the build works under `/netlogoSim/`.

## 7. Safe release order

```bash
# Review only
npx supabase db push --linked --dry-run

# Apply the additive migration. It first creates private snapshots in
# bluebits_backup, then adds recovery/audit/idempotency state and queues Sheets backfill.
npx supabase db push --linked --yes

# Add the preview limit and deploy changed functions.
npx supabase secrets set --project-ref vmtkzngknuayhxhjnqgq MAX_PREVIEW_BYTES=26214400
npx supabase functions deploy project-api --project-ref vmtkzngknuayhxhjnqgq
npx supabase functions deploy sheets-worker --project-ref vmtkzngknuayhxhjnqgq
npx supabase functions deploy google-owner --project-ref vmtkzngknuayhxhjnqgq

# Verify database and function health.
npx supabase db advisors --linked
npx supabase migration list --linked
npx supabase functions list --project-ref vmtkzngknuayhxhjnqgq
```

After Supabase verification, commit and push to `main`; GitHub Pages deploys through `.github/workflows/deploy.yml`. Confirm the Actions run passes before testing a real student upload. Do not delete `bluebits_backup` until an external database backup has been confirmed.
