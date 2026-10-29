const encoder = new TextEncoder();

export async function sha256(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function randomSecret(bytes = 24) {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function deriveTeamSecret(requestId: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`team:${requestId}`))));
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function signState(payload: Record<string, unknown>, secret: string) {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${body}.${base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body))))}`;
}

export async function verifyState(state: string, secret: string) {
  const [body, signature] = state.split('.');
  if (!body || !signature) return null;
  const expected = await signState(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))))), secret);
  if (expected !== state) return null;
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0)))));
}

export async function encryptSecret(value: string, secret: string) {
  const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value)));
  return { encrypted: base64url(encrypted), iv: base64url(iv) };
}

export async function decryptSecret(encrypted: string, iv: string, secret: string) {
  const decode = (v: string) => Uint8Array.from(atob(v.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, key, decode(encrypted)));
}
