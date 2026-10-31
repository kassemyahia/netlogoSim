const encoder = new TextEncoder();

export async function sha256(value: string | Uint8Array) {
  // Copy caller-owned typed arrays so Web Crypto always receives an
  // ArrayBuffer-backed view (and never a SharedArrayBuffer-backed one).
  const bytes = typeof value === 'string' ? encoder.encode(value) : Uint8Array.from(value);
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

function decodeBase64url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function signState(payload: Record<string, unknown>, secret: string) {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${body}.${base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body))))}`;
}

export async function verifyState(state: string, secret: string) {
  const [body, signature] = state.split('.');
  if (!body || !signature) return null;
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('HMAC', key, decodeBase64url(signature), encoder.encode(body));
    if (!valid) return null;
    return JSON.parse(new TextDecoder().decode(decodeBase64url(body)));
  } catch {
    return null;
  }
}

export async function encryptSecret(value: string, secret: string) {
  const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value)));
  return { encrypted: base64url(encrypted), iv: base64url(iv) };
}

export async function decryptSecret(encrypted: string, iv: string, secret: string) {
  const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBase64url(iv) }, key, decodeBase64url(encrypted)));
}
