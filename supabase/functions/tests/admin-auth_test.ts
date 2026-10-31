import { assertEquals } from 'jsr:@std/assert@1';
import { hasAdminRole, jwtIssuedAt, recentlyAuthenticated } from '../_shared/admin-auth.ts';

function unsignedToken(payload: Record<string, unknown>) {
  const encoded = btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `header.${encoded}.signature`;
}

Deno.test('admin authorization uses app metadata and extracts verified-token age', () => {
  const issuedAt = Math.floor(Date.now() / 1000) - 30;
  assertEquals(hasAdminRole({ role: 'admin' }), true);
  assertEquals(hasAdminRole({ admin: true }), true);
  assertEquals(hasAdminRole({ role: 'student' }), false);
  assertEquals(jwtIssuedAt(unsignedToken({ iat: issuedAt })), issuedAt);
  assertEquals(recentlyAuthenticated(issuedAt), true);
  assertEquals(recentlyAuthenticated(issuedAt - 700), false);
});
