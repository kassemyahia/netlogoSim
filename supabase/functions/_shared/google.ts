import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { decryptSecret } from './crypto.ts';

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
  const boundary = `bluebits_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: storedName, parents: [submissions_folder_id] });
  const prefix = new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/html\r\n\r\n`);
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(prefix.length + bytes.length + suffix.length); body.set(prefix); body.set(bytes, prefix.length); body.set(suffix, prefix.length + bytes.length);
  return (await googleFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body })).json() as Promise<{ id: string }>;
}

export async function downloadFile(fileId: string) { return googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`); }
export async function deleteFile(fileId: string) { await googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }); }

export async function sheetsBatchUpdate(requests: unknown[]) {
  const { spreadsheet_id } = await integrationConfig();
  return googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values:batchUpdate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ valueInputOption: 'RAW', data: requests }) });
}
