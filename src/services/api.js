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

function functionHeaders(accessToken) {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    apikey: key,
    authorization: `Bearer ${accessToken || key}`,
  };
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
export const listAdminProjects = () => invoke({ action: 'admin-list' });
export const recoverAdminCode = (projectId) => invoke({ action: 'admin-recover-code', projectId });
export const rotateAdminCode = (projectId) => invoke({ action: 'admin-rotate-code', projectId });
export const exportAdminCodes = () => invoke({ action: 'admin-export-codes' });

export async function uploadProject({ projectId, teamCode, file, requestId = crypto.randomUUID(), signal, onProgress, onStage, timeoutMs = 145_000 }) {
  if (configurationError) throw new PortalError('configuration', configurationError);
  const form = new FormData();
  form.set('action', 'upload');
  form.set('projectId', projectId);
  form.set('teamCode', teamCode);
  form.set('requestId', requestId);
  form.set('file', file);
  const { data } = await requireSupabase().auth.getSession();
  if (signal?.aborted) {
    const error = new Error('Request aborted'); error.name = 'AbortError'; throw error;
  }
  onStage?.('transferring');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = () => signal?.removeEventListener('abort', abort);
    xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-api`);
    const headers = functionHeaders(data.session?.access_token);
    xhr.setRequestHeader('apikey', headers.apikey);
    xhr.setRequestHeader('authorization', headers.authorization);
    xhr.setRequestHeader('x-request-id', requestId);
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.({ loaded: event.loaded, total: event.total, percent: Math.round((event.loaded / event.total) * 100) });
    };
    xhr.upload.onload = () => onStage?.('processing');
    xhr.onload = () => {
      finish();
      let body = {};
      try { body = JSON.parse(xhr.responseText || '{}'); } catch { /* mapped below */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.ok) { resolve(body); return; }
      const gatewayCode = xhr.getResponseHeader('sb-error-code');
      if (xhr.status === 504 || gatewayCode === 'IDLE_TIMEOUT') { reject(new PortalError('upload_timeout')); return; }
      if (xhr.status === 413) { reject(new PortalError('file_too_large')); return; }
      reject(new PortalError(body.code, body.error));
    };
    xhr.onerror = () => { finish(); reject(new PortalError('network')); };
    xhr.ontimeout = () => { finish(); reject(new PortalError('upload_timeout')); };
    xhr.onabort = () => { finish(); const error = new Error('Request aborted'); error.name = 'AbortError'; reject(error); };
    signal?.addEventListener('abort', abort, { once: true });
    xhr.send(form);
  });
}

export async function fetchProjectPreview(projectId, signal) {
  if (configurationError) throw new PortalError('configuration', configurationError);
  const { data } = await requireSupabase().auth.getSession();
  const timeout = AbortSignal.timeout(60_000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response;
  try {
    response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-api`, {
      method: 'POST',
      headers: { ...functionHeaders(data.session?.access_token), 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'preview', projectId }),
      signal: combinedSignal,
    });
  } catch (error) {
    throwIfAborted(error, signal);
    if (timeout.aborted) throw new PortalError('network');
    throw new PortalError('network');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new PortalError(body.code, body.error);
  }
  return response.text();
}
