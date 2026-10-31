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
    .select('id,grade,subject,unit,page,idea_description,is_submitted,created_at,members')
    .eq('grade', grade)
    .order('page', { ascending: true });
  if (signal) query.abortSignal(signal);
  const { data, error } = await query;
  if (error) {
    throwIfAborted(error, signal);
    throw new PortalError('database_read');
  }
  return data || [];
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
