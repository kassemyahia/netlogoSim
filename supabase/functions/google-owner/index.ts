import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { encryptSecret, signState, verifyState } from '../_shared/crypto.ts';
import { cors, friendlyError, json } from '../_shared/http.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/spreadsheets'];

async function google(token: string, url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`Google setup ${response.status}`);
  return response.json();
}

async function start(req: Request) {
  if (req.headers.get('x-owner-setup-secret') !== Deno.env.get('OWNER_SETUP_SECRET')) return friendlyError(req, 'unauthorized', 403);
  const state = await signState({ exp: Date.now() + 10 * 60_000, nonce: crypto.randomUUID() }, Deno.env.get('OAUTH_STATE_SECRET')!);
  const params = new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, redirect_uri: Deno.env.get('GOOGLE_REDIRECT_URI')!, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
  return json(req, { ok: true, authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}

async function callback(req: Request) {
  const url = new URL(req.url); const state = await verifyState(url.searchParams.get('state') || '', Deno.env.get('OAUTH_STATE_SECRET')!);
  if (!state || Number(state.exp) < Date.now() || !url.searchParams.get('code')) return new Response('Invalid or expired OAuth state.', { status: 400 });
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: url.searchParams.get('code')!, client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!, redirect_uri: Deno.env.get('GOOGLE_REDIRECT_URI')!, grant_type: 'authorization_code' }) });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.refresh_token) return new Response('Google did not issue an offline refresh token. Revoke the app grant and retry with consent.', { status: 400 });
  const encrypted = await encryptSecret(tokens.refresh_token, Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY')!);
  const { error: credentialError } = await admin.from('google_oauth_credentials').upsert({ singleton: true, encrypted_refresh_token: encrypted.encrypted, iv: encrypted.iv, updated_at: new Date().toISOString() });
  if (credentialError) return new Response('Could not store owner authorization.', { status: 500 });

  try {
    const folder = await google(tokens.access_token, 'https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', body: JSON.stringify({ name: 'BlueBits Private Submissions', mimeType: 'application/vnd.google-apps.folder' }) });
    const spreadsheet = await google(tokens.access_token, 'https://sheets.googleapis.com/v4/spreadsheets', { method: 'POST', body: JSON.stringify({ properties: { title: 'BlueBits Projects (Private Mirror)' }, sheets: [{ properties: { title: 'Projects' } }, { properties: { title: 'Members' } }] }) });
    await google(tokens.access_token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: [
      { range: 'Projects!A1:N1', values: [['Project ID','Grade','Subject','Unit','Page','Description','Team label','Registered at','Updated at','Submitted','Filename','Size bytes','SHA-256','Version']] },
      { range: 'Members!A1:E1', values: [['Member ID','Project ID','Position','Name','University ID']] },
    ] }) });
    const { error } = await admin.from('google_integration_config').upsert({ singleton: true, submissions_folder_id: folder.id, spreadsheet_id: spreadsheet.spreadsheetId, updated_at: new Date().toISOString() });
    if (error) throw error;
    return new Response('<!doctype html><html><body><h1>BlueBits Google setup complete</h1><p>The private folder and spreadsheet were created. You may close this window.</p></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  } catch {
    return new Response('Authorization was stored, but resource creation failed. Run setup again after checking Drive/Sheets API access.', { status: 502 });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (!Deno.env.get('GOOGLE_CLIENT_ID') || !Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY')) return friendlyError(req, 'configuration', 503);
  const url = new URL(req.url);
  if (req.method === 'GET' && url.searchParams.has('code')) return callback(req);
  if (req.method === 'POST') return start(req);
  return friendlyError(req, 'invalid_request');
});
