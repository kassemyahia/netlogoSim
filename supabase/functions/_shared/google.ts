import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { decryptSecret } from './crypto.ts';
import { uploadResumableChunks } from './resumable-upload.ts';

export class GoogleError extends Error { constructor(public code: string, message: string) { super(message); } }

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

export async function accessToken() {
  const { data, error } = await admin().from('google_oauth_credentials').select('encrypted_refresh_token,iv').eq('singleton', true).maybeSingle();
  if (error || !data) throw new GoogleError('configuration', 'Missing owner authorization');
  const refreshToken = await decryptSecret(data.encrypted_refresh_token, data.iv, Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY')!);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const payload = await response.json();
  if (!response.ok) {
    if (payload.error === 'invalid_grant') throw new GoogleError('google_reauthorization_required', 'Refresh token revoked or expired');
    throw new GoogleError('google_unavailable', 'Token refresh failed');
  }
  return payload.access_token as string;
}

async function googleFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${await accessToken()}`, ...(init.headers || {}) } });
  if (response.status === 401 || response.status === 403) throw new GoogleError('google_reauthorization_required', 'Google authorization rejected');
  if (!response.ok) throw new GoogleError(response.status >= 500 ? 'google_unavailable' : 'invalid_request', `Google API ${response.status}`);
  return response;
}

export async function integrationConfig() {
  const { data, error } = await admin().from('google_integration_config').select('submissions_folder_id,spreadsheet_id').eq('singleton', true).maybeSingle();
  if (error || !data) throw new GoogleError('configuration', 'Google resources are not configured');
  return data;
}

export async function uploadHtml(bytes: Uint8Array, storedName: string) {
  const { submissions_folder_id } = await integrationConfig();
  const token = await accessToken();
  let start: Response | null = null;
  let startError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      start = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json; charset=utf-8',
          'x-upload-content-type': 'text/html; charset=utf-8',
          'x-upload-content-length': String(bytes.length),
        },
        body: JSON.stringify({ name: storedName, parents: [submissions_folder_id] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (start.ok || ![408, 429, 500, 502, 503, 504].includes(start.status)) break;
      startError = new Error(`Google resumable session ${start.status}`);
    } catch (error) { startError = error; }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  }
  if (!start) throw new GoogleError('google_unavailable', startError instanceof Error ? startError.message : 'Google resumable session failed');
  if (start.status === 401 || start.status === 403) throw new GoogleError('google_reauthorization_required', 'Google authorization rejected');
  if (!start.ok) throw new GoogleError(start.status >= 500 ? 'google_unavailable' : 'invalid_request', `Google resumable session ${start.status}`);
  const sessionUrl = start.headers.get('location');
  if (!sessionUrl) throw new GoogleError('google_unavailable', 'Google resumable session URL missing');
  try {
    return await uploadResumableChunks({ sessionUrl, token, bytes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google resumable upload failed';
    if (message.includes('_401') || message.includes('_403')) throw new GoogleError('google_reauthorization_required', message);
    throw new GoogleError('google_unavailable', message);
  }
}

export async function downloadFile(fileId: string) { return googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`); }
export async function deleteFile(fileId: string) { await googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }); }

export async function sheetsBatchUpdate(requests: unknown[]) {
  const { spreadsheet_id } = await integrationConfig();
  return googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values:batchUpdate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ valueInputOption: 'RAW', data: requests }) });
}
