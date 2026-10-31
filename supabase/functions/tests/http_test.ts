import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { cors } from '../_shared/http.ts';

Deno.test('CORS preflight allows Supabase client headers for localhost', () => {
  const headers = cors(new Request('https://example.test', {
    method: 'OPTIONS',
    headers: { origin: 'http://localhost:5173' },
  }), ['https://locallost.me', 'http://localhost:5173']);

  assertEquals(headers['access-control-allow-origin'], 'http://localhost:5173');
  assertEquals(headers['access-control-allow-methods'], 'POST, OPTIONS');
  assertStringIncludes(headers['access-control-allow-headers'], 'x-client-info');
  assertStringIncludes(headers['access-control-allow-headers'], 'apikey');
  assertStringIncludes(headers['access-control-allow-headers'], 'x-retry-count');
});
