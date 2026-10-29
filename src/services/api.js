import { configurationError, requireSupabase } from './supabase';
import { messageForCode, PortalError } from './errors';

function throwIfAborted(error, signal) {
  if (signal?.aborted || error?.name === 'AbortError') {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    throw abortError;
  }
}

async function invoke(body, options = {}) {
  if (configurationError) throw new PortalError('configuration', configurationError);
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('project-api', {
    body,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (error) {
    let contextBody = null;
    try { contextBody = await error.context?.json?.(); } catch { /* return the redacted fallback */ }
    const providerCode = contextBody?.code || data?.code;
    if (providerCode === 'NOT_FOUND' || error.context?.status === 404) {
      throw new PortalError('service_not_deployed');
    }
    if (providerCode && messageForCode(providerCode) !== messageForCode('unavailable')) {
      throw new PortalError(providerCode);
    }
    if (error.name === 'FunctionsFetchError' || !error.context) throw new PortalError('network');
    throw new PortalError('unavailable');
  }
  if (!data?.ok) throw new PortalError(data?.code, data?.error);
  return data;
}

export async function listProjects(grade, signal) {
  const client = requireSupabase();
  const query = client
    .from('public_projects')
    // Keep this projection compatible with the legacy production view while the
    // secure migration is pending. Never request legacy member/file columns.
    .select('id,grade,subject,unit,page,idea_description,is_submitted')
    .eq('grade', grade)
    .order('page', { ascending: true });
  if (signal) query.abortSignal(signal);
  const { data, error } = await query;
  if (error) {
    throwIfAborted(error, signal);
    throw new PortalError('database_read');
  }
  return (data || []).map((project) => ({
    ...project,
    team_label: `فريق ${String(project.id).slice(0, 6)}`,
  }));
}

export async function countProjects(signal) {
  const query = requireSupabase()
    .from('public_projects')
    .select('id', { count: 'exact', head: true });
  if (signal) query.abortSignal(signal);
  const { count, error } = await query;
  if (error) {
    throwIfAborted(error, signal);
    throw new PortalError('database_read');
  }
  return count || 0;
}

export const registerProject = (payload) => invoke({ action: 'register', ...payload });
export const upgradeLegacyCode = (projectId, legacyCode, requestId) => invoke({ action: 'upgrade-code', projectId, legacyCode, requestId });

export async function uploadProject({ projectId, teamCode, file }) {
  const form = new FormData();
  form.set('action', 'upload');
  form.set('projectId', projectId);
  form.set('teamCode', teamCode);
  form.set('file', file);
  return invoke(form);
}

export async function downloadProject({ projectId, teamCode }) {
  if (configurationError) throw new PortalError('configuration', configurationError);
  const { data: session } = await requireSupabase().auth.getSession();
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-api`,
    {
      method: 'POST',
      headers: {
        apikey:
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          import.meta.env.VITE_SUPABASE_ANON_KEY,
        authorization: `Bearer ${session.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'download', projectId, teamCode }),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 404 || body.code === 'NOT_FOUND') throw new PortalError('service_not_deployed');
    throw new PortalError(body.code, body.error);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return { blob, filename: encoded ? decodeURIComponent(encoded) : 'project.html' };
}
