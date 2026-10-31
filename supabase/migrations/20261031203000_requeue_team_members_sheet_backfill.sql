-- The initial backfill may have been consumed by the previous worker version
-- during the function deployment window. Requeue stable project rows after
-- the Team Members (column O) writer is live.
update public.sync_outbox
set status = 'retry',
    available_at = now(),
    attempts = 0,
    locked_at = null,
    locked_by = null,
    completed_at = null,
    last_error_code = null,
    last_error_at = null
where aggregate_type = 'project'
  and event_type = 'project_upsert';
