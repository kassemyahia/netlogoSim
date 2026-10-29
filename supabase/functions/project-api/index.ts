import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { deriveTeamSecret, sha256 } from '../_shared/crypto.ts';
import { deleteFile, downloadFile, GoogleError, uploadHtml } from '../_shared/google.ts';
import { cors, friendlyError, getClientAddress, json } from '../_shared/http.ts';
import { contentOkay, filenameOkay, GRADES, safeText, SUBJECTS, validMembers } from '../_shared/project-validation.ts';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const MAX_BYTES = Number(Deno.env.get('MAX_HTML_BYTES') || 25 * 1024 * 1024);
async function tokenHash(token: string) { return sha256(`${Deno.env.get('TEAM_SECRET_PEPPER')}:${token}`); }
async function limit(scope: string, subject: string, count: number, seconds: number) {
  const { data, error } = await admin.rpc('check_rate_limit', { p_scope: scope, p_subject_hash: await sha256(`${Deno.env.get('RATE_LIMIT_PEPPER')}:${subject}`), p_limit: count, p_window_seconds: seconds });
  return !error && data === true;
}

async function verifyTurnstile(token: unknown, ip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return true;
  if (typeof token !== 'string' || !token) return false;
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret, response: token, remoteip: ip }) });
  return response.ok && (await response.json()).success === true;
}


async function isAdmin(req: Request) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer || bearer === SERVICE_KEY) return false;
  const { data } = await admin.auth.getUser(bearer);
  return data.user?.app_metadata?.role === 'admin' || data.user?.app_metadata?.admin === true;
}

async function authorize(req: Request, projectId: string, teamCode: string) {
  if (await isAdmin(req)) return true;
  if (!teamCode || !(await limit('team_code', `${getClientAddress(req)}:${projectId}`, 10, 900))) return false;
  const { data, error } = await admin.rpc('authorize_team', { p_project_id: projectId, p_hash: await tokenHash(teamCode) });
  return !error && data === true;
}

async function register(req: Request, body: Record<string, unknown>) {
  const ip = getClientAddress(req);
  if (!(await limit('register', ip, 8, 3600))) return friendlyError(req, 'rate_limited', 429);
  if (!(await verifyTurnstile(body.turnstileToken, ip))) return friendlyError(req, 'bot_check', 400);
  if (!validMembers(body.members) || !GRADES.has(body.grade as string) || !SUBJECTS.has(body.subject as string) || !safeText(body.unit, 160) || !safeText(body.ideaDescription, 2000) || !Number.isInteger(body.page) || Number(body.page) < 1 || Number(body.page) > 10000 || typeof body.requestId !== 'string') return friendlyError(req, 'invalid_team');
  const teamCode = await deriveTeamSecret(body.requestId, Deno.env.get('TEAM_SECRET_DERIVATION_KEY')!);
  const teamLabel = `فريق ${teamCode.slice(0, 6)}`;
  const { data, error } = await admin.rpc('register_project_secure', { p_request_id: body.requestId, p_grade: body.grade, p_subject: body.subject, p_unit: body.unit, p_page: body.page, p_description: body.ideaDescription, p_team_label: teamLabel, p_team_secret_hash: await tokenHash(teamCode), p_members: body.members });
  if (error) {
    if (error.message?.includes('reservation_taken') || error.code === '23505') return friendlyError(req, 'reservation_taken', 409);
    console.error(JSON.stringify({ event: 'registration_failed', code: error.code }));
    return friendlyError(req, 'invalid_request', 400);
  }
  return json(req, { ok: true, projectId: data.projectId, teamCode });
}

async function upgradeCode(req: Request, body: Record<string, unknown>) {
  const projectId = String(body.projectId || ''); const legacyCode = String(body.legacyCode || ''); const requestId = String(body.requestId || '');
  if (!legacyCode || !/^[0-9a-f-]{36}$/i.test(projectId) || !/^[0-9a-f-]{36}$/i.test(requestId) || !(await limit('team_code', `${getClientAddress(req)}:${projectId}`, 10, 900))) return friendlyError(req, 'unauthorized', 403);
  const teamCode = await deriveTeamSecret(requestId, Deno.env.get('TEAM_SECRET_DERIVATION_KEY')!);
  const { data, error } = await admin.rpc('rotate_legacy_team_code', { p_project_id: projectId, p_legacy_hash: await sha256(legacyCode), p_new_hash: await tokenHash(teamCode) });
  if (error || !data) return friendlyError(req, 'unauthorized', 403);
  return json(req, { ok: true, teamCode });
}

async function upload(req: Request, form: FormData) {
  const projectId = String(form.get('projectId') || ''); const teamCode = String(form.get('teamCode') || ''); const file = form.get('file');
  if (!crypto.randomUUID || !/^[0-9a-f-]{36}$/i.test(projectId) || !(file instanceof File)) return friendlyError(req, 'invalid_request');
  if (!(await authorize(req, projectId, teamCode))) return friendlyError(req, 'unauthorized', 403);
  if (!(await limit('upload', `${getClientAddress(req)}:${projectId}`, 8, 3600))) return friendlyError(req, 'rate_limited', 429);
  if (file.size <= 0 || file.size > MAX_BYTES) return friendlyError(req, file.size > MAX_BYTES ? 'file_too_large' : 'invalid_file', 413);
  if (!filenameOkay(file.name)) return friendlyError(req, 'invalid_file');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!contentOkay(bytes)) return friendlyError(req, 'invalid_file');
  const checksum = await sha256(bytes);
  const { data: pending, error: beginError } = await admin.rpc('begin_submission', { p_project_id: projectId, p_filename: file.name.normalize('NFC'), p_size: file.size, p_sha256: checksum });
  if (beginError) return friendlyError(req, 'invalid_request');
  let driveId: string | null = null;
  try {
    driveId = (await uploadHtml(bytes, pending.storedFilename)).id;
    const { error: activateError } = await admin.rpc('activate_submission', { p_submission_id: pending.submissionId, p_drive_file_id: driveId });
    if (activateError) throw activateError;
    return json(req, { ok: true, version: pending.version });
  } catch (error) {
    await admin.from('project_submissions').update({ state: 'failed', failure_code: error instanceof GoogleError ? error.code : 'commit_failed', ...(driveId ? { drive_file_id: driveId } : {}) }).eq('id', pending.submissionId);
    if (driveId) try { await deleteFile(driveId); await admin.from('project_submissions').update({ drive_file_id: null }).eq('id', pending.submissionId); } catch { await admin.from('project_submissions').update({ state: 'cleanup_pending' }).eq('id', pending.submissionId); }
    const code = error instanceof GoogleError ? error.code : 'google_unavailable';
    console.error(JSON.stringify({ event: 'submission_failed', projectId, code }));
    return friendlyError(req, code, 503);
  }
}

async function download(req: Request, body: Record<string, unknown>) {
  const projectId = String(body.projectId || ''); const teamCode = String(body.teamCode || '');
  if (!(await authorize(req, projectId, teamCode))) return friendlyError(req, 'unauthorized', 403);
  const { data } = await admin.from('project_submissions').select('drive_file_id,original_filename').eq('project_id', projectId).eq('state', 'active').maybeSingle();
  if (!data?.drive_file_id) return friendlyError(req, 'no_submission', 404);
  try {
    const google = await downloadFile(data.drive_file_id);
    return new Response(google.body, { headers: { ...cors(req), 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(data.original_filename)}`, 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store, max-age=0' } });
  } catch (error) { return friendlyError(req, error instanceof GoogleError ? error.code : 'google_unavailable', 503); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST' || !Deno.env.get('TEAM_SECRET_PEPPER') || !Deno.env.get('TEAM_SECRET_DERIVATION_KEY')) return friendlyError(req, 'configuration', 503);
  try {
    const type = req.headers.get('content-type') || '';
    if (type.includes('multipart/form-data')) { const form = await req.formData(); return String(form.get('action')) === 'upload' ? upload(req, form) : friendlyError(req, 'invalid_request'); }
    const body = await req.json();
    if (body.action === 'register') return register(req, body);
    if (body.action === 'upgrade-code') return upgradeCode(req, body);
    if (body.action === 'download') return download(req, body);
    return friendlyError(req, 'invalid_request');
  } catch { return friendlyError(req, 'invalid_request'); }
});
