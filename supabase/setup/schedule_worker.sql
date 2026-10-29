-- Run once in the Supabase SQL editor after deploying sheets-worker.
-- Replace both placeholders. Vault keeps values out of this repository.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'bluebits_project_url');
select vault.create_secret('REPLACE_WITH_SYNC_WORKER_SECRET', 'bluebits_worker_secret');

select cron.schedule(
  'bluebits-sheets-worker',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='bluebits_project_url') || '/functions/v1/sheets-worker',
    headers := jsonb_build_object('content-type','application/json','x-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='bluebits_worker_secret')),
    body := '{"action":"process"}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
