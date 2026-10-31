# BlueBits NetLogo Projects Portal

Arabic RTL portal for reserving textbook experiments, privately storing NetLogo HTML exports, and previewing the active export through a server-controlled isolated viewer. The frontend remains a Vite/React application for GitHub Pages; Supabase is the authoritative database and trusted API; private files and the one-way spreadsheet mirror live in the owner's Google Drive.

## Local frontend

Requirements: Node.js 22 or newer and npm 10 or newer.

```bash
cp .env.example .env
# Fill VITE_SUPABASE_URL and one public/publishable key.
npm ci
npm run dev
```

Quality commands:

```bash
npm run lint
npm test
npm run build
```

The app deliberately fails with a visible Arabic configuration message when Supabase configuration is absent. `VITE_SUPABASE_PUBLISHABLE_KEY` is preferred; `VITE_SUPABASE_ANON_KEY` is a legacy fallback. Never place a service-role key or Google credential in a `VITE_` variable.

## Architecture and privacy boundary

- `public_projects` contains reservation data and ordered member names. University IDs, secrets, private Drive IDs, and file URLs are excluded.
- The browser can read the public view. Registrations, uploads, replacements, previews, legacy-code upgrades, and administrative work pass through Edge Functions.
- New team codes are deterministic only for an idempotency request ID and a secret server HMAC key, yielding 256 bits. Only a peppered SHA-256 digest is stored. A repeated registration request can therefore recover the same code after a lost response without storing plaintext.
- HTML is untrusted executable content. Public preview bytes are resolved by project ID, returned as `application/octet-stream` with `nosniff`, hardened with a restrictive CSP, and executed only in an iframe sandbox containing `allow-scripts` without `allow-same-origin`, forms, popups, or top navigation.
- Uploads use browser transfer progress, cancellation, a bounded timeout, idempotency request IDs, and Google Drive resumable chunks. The previous active version remains active until the replacement is fully persisted and atomically activated.
- Owner code recovery is enforced server-side using verified Supabase Auth `app_metadata`. Deterministic codes are regenerated from private registration request IDs; irrecoverable legacy/rotated codes can only be replaced. Sensitive actions are rate-limited and audited without logging codes.
- Supabase is the source of truth. Sheets is a private, one-way, idempotent mirror processed from a transactional outbox.

Full owner setup and migration instructions are in [docs/OWNER_SETUP.md](docs/OWNER_SETUP.md). Production migration assumptions are in [docs/MIGRATION.md](docs/MIGRATION.md).
