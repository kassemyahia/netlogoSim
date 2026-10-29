import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { deleteFile, GoogleError, sheetsBatchUpdate } from '../_shared/google.ts';
import { cors, friendlyError, json } from '../_shared/http.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const literal = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

async function row(tab: 'Projects' | 'Members', key: string) {
  await admin.from('sheet_row_map').upsert({ tab_name: tab, entity_key: key }, { onConflict: 'tab_name,entity_key', ignoreDuplicates: true });
  const { data, error } = await admin.from('sheet_row_map').select('row_number').eq('tab_name', tab).eq('entity_key', key).single();
  if (error) throw error;
  return Number(data.row_number) + 1;
}

async function syncProject(projectId: string) {
  const [{ data: project, error }, { data: members }] = await Promise.all([
    admin.from('projects').select('id,grade,subject,unit,page,idea_description,team_label,is_submitted,created_at,updated_at').eq('id', projectId).single(),
    admin.from('project_members').select('id,project_id,position,name,university_id').eq('project_id', projectId).order('position'),
  ]);
  if (error) throw error;
  const { data: submission } = await admin.from('project_submissions').select('original_filename,size_bytes,sha256,version').eq('project_id', projectId).eq('state', 'active').maybeSingle();
  const projectRow = await row('Projects', projectId);
  const data: unknown[] = [{ range: `Projects!A${projectRow}:N${projectRow}`, values: [[project.id, project.grade, project.subject, literal(project.unit), String(project.page), literal(project.idea_description), literal(project.team_label), project.created_at, project.updated_at, String(project.is_submitted), literal(submission?.original_filename), submission?.size_bytes ? String(submission.size_bytes) : '', submission?.sha256 || '', submission?.version ? String(submission.version) : '']] }];
  for (const member of members || []) {
    const memberRow = await row('Members', member.id);
    data.push({ range: `Members!A${memberRow}:E${memberRow}`, values: [[member.id, member.project_id, String(member.position), literal(member.name), literal(member.university_id)]] });
  }
  await sheetsBatchUpdate(data);
}

async function backfill() {
  const { data: projects, error } = await admin.from('projects').select('id');
  if (error) throw error;
  for (const project of projects || []) {
    await admin.from('sync_outbox').upsert({ aggregate_type: 'project', aggregate_id: project.id, event_type: 'project_upsert', status: 'retry', available_at: new Date().toISOString(), attempts: 0, last_error_code: null }, { onConflict: 'aggregate_type,aggregate_id,event_type' });
  }
  return projects?.length || 0;
}

async function reconcileIncompleteOperations() {
  const { data: cleanup } = await admin.from('project_submissions').select('id,drive_file_id').eq('state', 'cleanup_pending').limit(20);
  for (const item of cleanup || []) {
    if (!item.drive_file_id) continue;
    try {
      await deleteFile(item.drive_file_id);
      await admin.from('project_submissions').update({ state: 'failed', drive_file_id: null, failure_code: 'orphan_cleaned' }).eq('id', item.id).eq('state', 'cleanup_pending');
    } catch { /* keep visible for the next bounded worker pass */ }
  }
  await admin.from('project_submissions').update({ state: 'failed', failure_code: 'stale_upload' }).eq('state', 'uploading').lt('created_at', new Date(Date.now() - 60 * 60_000).toISOString());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST' || req.headers.get('x-worker-secret') !== Deno.env.get('SYNC_WORKER_SECRET')) return friendlyError(req, 'unauthorized', 403);
  const body = await req.json().catch(() => ({}));
  if (body.action === 'backfill') return json(req, { ok: true, queued: await backfill() });
  await admin.from('api_rate_limits').delete().lt('window_start', new Date(Date.now() - 2 * 86_400_000).toISOString());
  await reconcileIncompleteOperations();
  const workerId = crypto.randomUUID();
  const { data: jobs, error } = await admin.rpc('claim_sync_jobs', { p_worker: workerId, p_limit: 20 });
  if (error) return friendlyError(req, 'invalid_request', 500);
  let completed = 0; let failed = 0;
  for (const job of jobs || []) {
    try {
      const projectId = job.aggregate_type === 'project' ? job.aggregate_id : (await admin.from('project_submissions').select('project_id').eq('id', job.aggregate_id).single()).data?.project_id;
      if (!projectId) throw new Error('missing_project');
      await syncProject(projectId);
      await admin.from('sync_outbox').update({ status: 'completed', completed_at: new Date().toISOString(), locked_at: null, locked_by: null, last_error_code: null }).eq('id', job.id).eq('locked_by', workerId);
      completed++;
    } catch (error) {
      const terminal = job.attempts >= 8;
      const delaySeconds = Math.min(3600, 15 * 2 ** Math.min(job.attempts, 8));
      await admin.from('sync_outbox').update({ status: terminal ? 'dead' : 'retry', available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(), locked_at: null, locked_by: null, last_error_code: error instanceof GoogleError ? error.code : 'sync_failed', last_error_at: new Date().toISOString() }).eq('id', job.id).eq('locked_by', workerId);
      failed++;
    }
  }
  return json(req, { ok: true, claimed: jobs?.length || 0, completed, failed });
});
