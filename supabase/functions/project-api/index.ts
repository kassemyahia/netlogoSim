import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { bearerToken, hasAdminRole, recentlyAuthenticated, VerifiedAdmin } from '../_shared/admin-auth.ts';
import { deriveTeamSecret, randomSecret, sha256 } from '../_shared/crypto.ts';
import { deleteFile, downloadFile, GoogleError, uploadHtml } from '../_shared/google.ts';
import { cors, friendlyError, getClientAddress, json } from '../_shared/http.ts';
import { contentOkay, filenameOkay, GRADES, safeText, SUBJECTS, validMembers, validProjectId } from '../_shared/project-validation.ts';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const MAX_BYTES = Number(Deno.env.get('MAX_HTML_BYTES') || 25 * 1024 * 1024);
const MAX_PREVIEW_BYTES = Number(Deno.env.get('MAX_PREVIEW_BYTES') || MAX_BYTES);
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


async function adminContext(req: Request): Promise<VerifiedAdmin | null> {
  const bearer = bearerToken(req);
  if (!bearer || bearer === SERVICE_KEY) return null;
  const { data } = await admin.auth.getUser(bearer);
  if (!data.user || !hasAdminRole(data.user.app_metadata)) return null;
  return { userId: data.user.id, authenticatedAt: Math.floor(new Date(data.user.last_sign_in_at || 0).getTime() / 1000) };
}

async function authorize(req: Request, projectId: string, teamCode: string) {
  if (await adminContext(req)) return true;
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
  if (!legacyCode || !validProjectId(projectId) || !/^[0-9a-f-]{36}$/i.test(requestId) || !(await limit('team_code', `${getClientAddress(req)}:${projectId}`, 10, 900))) return friendlyError(req, 'unauthorized', 403);
  const teamCode = await deriveTeamSecret(requestId, Deno.env.get('TEAM_SECRET_DERIVATION_KEY')!);
  const { data, error } = await admin.rpc('rotate_legacy_team_code', { p_project_id: projectId, p_legacy_hash: await sha256(legacyCode), p_new_hash: await tokenHash(teamCode) });
  if (error || !data) return friendlyError(req, 'unauthorized', 403);
  return json(req, { ok: true, teamCode });
}

async function upload(req: Request, form: FormData) {
  const projectId = String(form.get('projectId') || ''); const teamCode = String(form.get('teamCode') || ''); const file = form.get('file');
  const requestId = String(form.get('requestId') || '');
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  if (!validProjectId(projectId) || !(file instanceof File) || !/^[0-9a-f-]{36}$/i.test(requestId)) return friendlyError(req, 'invalid_request');
  if (!(await authorize(req, projectId, teamCode))) return friendlyError(req, 'unauthorized', 403);
  if (!(await limit('upload', `${getClientAddress(req)}:${projectId}`, 8, 3600))) return friendlyError(req, 'rate_limited', 429);
  if (file.size <= 0 || file.size > MAX_BYTES) return friendlyError(req, file.size > MAX_BYTES ? 'file_too_large' : 'invalid_file', 413);
  if (!filenameOkay(file.name)) return friendlyError(req, 'invalid_file');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!contentOkay(bytes)) return friendlyError(req, 'invalid_file');
  const checksum = await sha256(bytes);
  console.info(JSON.stringify({ event: 'upload_validated', correlationId, projectId, sizeBytes: file.size }));
  const { data: pending, error: beginError } = await admin.rpc('begin_submission', { p_project_id: projectId, p_filename: file.name.normalize('NFC'), p_size: file.size, p_sha256: checksum, p_request_id: requestId });
  if (beginError) return friendlyError(req, 'invalid_request');
  if (pending.alreadyActive) return json(req, { ok: true, version: pending.version, idempotent: true });
  if (pending.alreadyInProgress) return friendlyError(req, 'upload_in_progress', 409);
  let driveId: string | null = null;
  try {
    driveId = (await uploadHtml(bytes, pending.storedFilename)).id;
    console.info(JSON.stringify({ event: 'upload_drive_saved', correlationId, projectId, version: pending.version }));
    const { error: activateError } = await admin.rpc('activate_submission', { p_submission_id: pending.submissionId, p_drive_file_id: driveId });
    if (activateError) throw activateError;
    console.info(JSON.stringify({ event: 'upload_activated', correlationId, projectId, version: pending.version }));
    return json(req, { ok: true, version: pending.version });
  } catch (error) {
    await admin.from('project_submissions').update({ state: 'failed', failure_code: error instanceof GoogleError ? error.code : 'commit_failed', ...(driveId ? { drive_file_id: driveId } : {}) }).eq('id', pending.submissionId);
    if (driveId) try { await deleteFile(driveId); await admin.from('project_submissions').update({ drive_file_id: null }).eq('id', pending.submissionId); } catch { await admin.from('project_submissions').update({ state: 'cleanup_pending' }).eq('id', pending.submissionId); }
    const code = error instanceof GoogleError ? error.code : 'google_unavailable';
    console.error(JSON.stringify({ event: 'submission_failed', correlationId, projectId, code }));
    return friendlyError(req, code, 503);
  }
}

async function preview(req: Request, body: Record<string, unknown>) {
  const projectId = String(body.projectId || '');
  if (!validProjectId(projectId)) return friendlyError(req, 'invalid_request');
  if (!(await limit('preview', `${getClientAddress(req)}:${projectId}`, 60, 300))) return friendlyError(req, 'rate_limited', 429);
  const { data, error } = await admin.from('project_submissions')
    .select('drive_file_id,size_bytes')
    .eq('project_id', projectId)
    .eq('state', 'active')
    .maybeSingle();
  if (error) return friendlyError(req, 'invalid_request', 500);
  if (!data?.drive_file_id) return friendlyError(req, 'no_submission', 404);
  if (Number(data.size_bytes) > MAX_PREVIEW_BYTES) return friendlyError(req, 'file_too_large', 413);
  try {
    const google = await downloadFile(data.drive_file_id);
    const declaredLength = Number(google.headers.get('content-length') || 0);
    if (declaredLength > MAX_PREVIEW_BYTES) return friendlyError(req, 'file_too_large', 413);
    const bytes = new Uint8Array(await google.arrayBuffer());
    if (bytes.length > MAX_PREVIEW_BYTES) return friendlyError(req, 'file_too_large', 413);
    return new Response(bytes, {
      status: 200,
      headers: {
        ...cors(req),
        'content-type': 'application/octet-stream',
        'content-disposition': 'attachment; filename="project-preview.html"',
        'content-security-policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store, max-age=0',
        'cross-origin-resource-policy': 'cross-origin',
      },
    });
  } catch (error) {
    return friendlyError(req, error instanceof GoogleError ? error.code : 'google_unavailable', 503);
  }
}

async function requireAdmin(req: Request, scope: string, maximum: number) {
  const owner = await adminContext(req);
  if (!owner) return null;
  const allowed = await limit(scope, `${owner.userId}:${getClientAddress(req)}`, maximum, 3600);
  return allowed ? owner : null;
}

async function audit(req: Request, owner: VerifiedAdmin, action: string, projectId: string | null, metadata: Record<string, unknown> = {}) {
  const ipHash = await sha256(`${Deno.env.get('RATE_LIMIT_PEPPER')}:${getClientAddress(req)}`);
  const { error } = await admin.from('admin_audit_log').insert({ actor_id: owner.userId, action, project_id: projectId, ip_hash: ipHash, metadata });
  if (error) throw error;
}

async function adminList(req: Request) {
  const owner = await requireAdmin(req, 'admin_list', 120);
  if (!owner) return friendlyError(req, 'unauthorized', 403);
  const [{ data: projects, error: projectError }, { data: members, error: memberError }, { data: requests, error: requestError }] = await Promise.all([
    admin.from('projects').select('id,grade,subject,unit,page,idea_description,is_submitted,created_at').order('created_at', { ascending: false }).limit(1000),
    admin.from('project_members').select('project_id,position,name').order('position'),
    admin.from('operation_requests').select('project_id').eq('action', 'register').not('project_id', 'is', null),
  ]);
  if (projectError || memberError || requestError) return friendlyError(req, 'invalid_request', 500);
  const membersByProject = new Map<string, unknown[]>();
  for (const member of members || []) {
    const key = String(member.project_id); const current = membersByProject.get(key) || [];
    current.push({ position: member.position, name: member.name }); membersByProject.set(key, current);
  }
  const recoverableIds = new Set((requests || []).map((request) => String(request.project_id)));
  return json(req, { ok: true, projects: (projects || []).map((project) => ({ ...project, members: membersByProject.get(String(project.id)) || [], hasRecoveryRecord: recoverableIds.has(String(project.id)) })) });
}

async function recoverCode(req: Request, body: Record<string, unknown>) {
  const owner = await requireAdmin(req, 'admin_code', 30);
  const projectId = String(body.projectId || '');
  if (!owner || !validProjectId(projectId)) return friendlyError(req, 'unauthorized', 403);
  const [{ data: project }, { data: request }] = await Promise.all([
    admin.from('projects').select('team_secret_hash').eq('id', projectId).maybeSingle(),
    admin.from('operation_requests').select('request_id').eq('action', 'register').eq('project_id', projectId).order('created_at').limit(1).maybeSingle(),
  ]);
  if (!project || !request?.request_id) return friendlyError(req, 'code_not_recoverable', 409);
  const teamCode = await deriveTeamSecret(request.request_id, Deno.env.get('TEAM_SECRET_DERIVATION_KEY')!);
  if (await tokenHash(teamCode) !== project.team_secret_hash) return friendlyError(req, 'code_not_recoverable', 409);
  await audit(req, owner, 'code_recovered', projectId);
  return json(req, { ok: true, teamCode });
}

async function rotateCode(req: Request, body: Record<string, unknown>) {
  const owner = await requireAdmin(req, 'admin_code', 30);
  const projectId = String(body.projectId || '');
  if (!owner || !validProjectId(projectId)) return friendlyError(req, 'unauthorized', 403);
  const teamCode = randomSecret(24);
  const ipHash = await sha256(`${Deno.env.get('RATE_LIMIT_PEPPER')}:${getClientAddress(req)}`);
  const { data, error } = await admin.rpc('admin_rotate_team_code', { p_project_id: projectId, p_new_hash: await tokenHash(teamCode), p_actor_id: owner.userId, p_ip_hash: ipHash });
  if (error || !data) return friendlyError(req, 'unauthorized', 403);
  return json(req, { ok: true, teamCode });
}

async function exportCodes(req: Request) {
  const owner = await requireAdmin(req, 'admin_export', 5);
  if (!owner) return friendlyError(req, 'unauthorized', 403);
  if (!recentlyAuthenticated(owner.authenticatedAt)) return friendlyError(req, 'fresh_auth_required', 401);
  const [{ data: projects, error: projectError }, { data: requests, error: requestError }] = await Promise.all([
    admin.from('projects').select('id,grade,subject,unit,page,team_secret_hash').limit(1000),
    admin.from('operation_requests').select('project_id,request_id').eq('action', 'register').not('project_id', 'is', null),
  ]);
  if (projectError || requestError) return friendlyError(req, 'invalid_request', 500);
  const projectById = new Map((projects || []).map((project) => [String(project.id), project]));
  const codes = [];
  for (const request of requests || []) {
    const project = projectById.get(String(request.project_id));
    if (!project) continue;
    const teamCode = await deriveTeamSecret(request.request_id, Deno.env.get('TEAM_SECRET_DERIVATION_KEY')!);
    if (await tokenHash(teamCode) === project.team_secret_hash) codes.push({ projectId: project.id, grade: project.grade, subject: project.subject, unit: project.unit, page: project.page, teamCode });
  }
  await audit(req, owner, 'codes_exported', null, { count: codes.length });
  return json(req, { ok: true, codes });
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
    if (body.action === 'preview') return preview(req, body);
    if (body.action === 'admin-list') return adminList(req);
    if (body.action === 'admin-recover-code') return recoverCode(req, body);
    if (body.action === 'admin-rotate-code') return rotateCode(req, body);
    if (body.action === 'admin-export-codes') return exportCodes(req);
    return friendlyError(req, 'invalid_request');
  } catch { return friendlyError(req, 'invalid_request'); }
});
