import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sha256 } from '../_shared/crypto.ts';
import { deleteFile, uploadHtml } from '../_shared/google.ts';
import { contentOkay, filenameOkay } from '../_shared/project-validation.ts';
import { cors, friendlyError, json } from '../_shared/http.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const MAX_BYTES = Number(Deno.env.get('MAX_HTML_BYTES') || 25 * 1024 * 1024);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST' || req.headers.get('x-worker-secret') !== Deno.env.get('MIGRATION_WORKER_SECRET')) return friendlyError(req, 'unauthorized', 403);
  const { data: projects, error } = await admin.from('projects').select('id,legacy_file_url,legacy_file_name').eq('legacy_migration_status', 'pending').limit(10);
  if (error) return friendlyError(req, 'invalid_request', 500);
  let migrated = 0; let failed = 0;
  for (const project of projects || []) {
    let driveId: string | null = null; let submissionId: string | null = null;
    try {
      const response = await fetch(project.legacy_file_url, { redirect: 'follow' });
      if (!response.ok) throw new Error('legacy_fetch_failed');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const original = filenameOkay(project.legacy_file_name || '') ? project.legacy_file_name : `${project.id}.html`;
      if (bytes.length <= 0 || bytes.length > MAX_BYTES || !contentOkay(bytes)) throw new Error('legacy_invalid_html');
      const { data: pending, error: beginError } = await admin.rpc('begin_submission', { p_project_id: project.id, p_filename: original, p_size: bytes.length, p_sha256: await sha256(bytes) });
      if (beginError) throw beginError;
      submissionId = pending.submissionId;
      driveId = (await uploadHtml(bytes, pending.storedFilename)).id;
      const { error: activateError } = await admin.rpc('activate_submission', { p_submission_id: submissionId, p_drive_file_id: driveId });
      if (activateError) throw activateError;
      await admin.from('projects').update({ legacy_migration_status: 'migrated' }).eq('id', project.id);
      migrated++;
    } catch {
      if (submissionId) await admin.from('project_submissions').update({ state: 'failed', failure_code: 'legacy_migration_failed', ...(driveId ? { drive_file_id: driveId } : {}) }).eq('id', submissionId);
      if (driveId) try { await deleteFile(driveId); if (submissionId) await admin.from('project_submissions').update({ drive_file_id: null }).eq('id', submissionId); } catch { if (submissionId) await admin.from('project_submissions').update({ state: 'cleanup_pending' }).eq('id', submissionId); }
      await admin.from('projects').update({ legacy_migration_status: 'failed' }).eq('id', project.id);
      failed++;
    }
  }
  return json(req, { ok: true, examined: projects?.length || 0, migrated, failed });
});
