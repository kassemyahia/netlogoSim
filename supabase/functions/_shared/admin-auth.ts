export type VerifiedAdmin = {
  userId: string;
  authenticatedAt: number;
};

export function bearerToken(req: Request) {
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
}

export function jwtIssuedAt(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
    return Number(JSON.parse(atob(padded)).iat || 0);
  } catch {
    return 0;
  }
}

export function hasAdminRole(appMetadata: Record<string, unknown> | undefined) {
  return appMetadata?.role === 'admin' || appMetadata?.admin === true;
}

export function recentlyAuthenticated(authenticatedAt: number, maximumAgeSeconds = 600) {
  const age = Math.floor(Date.now() / 1000) - authenticatedAt;
  return authenticatedAt > 0 && age >= 0 && age <= maximumAgeSeconds;
}
