import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { uploadResumableChunks } from '../_shared/resumable-upload.ts';

Deno.test('resumable upload sends a 7.4 MB file in ordered aligned ranges', async () => {
  const ranges: string[] = [];
  const bytes = new Uint8Array(7_400_000);
  const result = await uploadResumableChunks({
    sessionUrl: 'https://upload.example/session',
    token: 'test-token',
    bytes,
    fetcher: (_url, init) => {
      const range = new Headers(init?.headers).get('content-range') || '';
      ranges.push(range);
      const final = ranges.length === 2;
      return Promise.resolve(new Response(final ? JSON.stringify({ id: 'drive-id' }) : null, { status: final ? 200 : 308 }));
    },
  });
  assertEquals(result.id, 'drive-id');
  assertEquals(ranges, ['bytes 0-4194303/7400000', 'bytes 4194304-7399999/7400000']);
});

Deno.test('resumable upload retries a transient Google response without advancing', async () => {
  const ranges: string[] = [];
  let calls = 0;
  const result = await uploadResumableChunks({
    sessionUrl: 'https://upload.example/session',
    token: 'test-token',
    bytes: new Uint8Array(1024 * 1024),
    fetcher: (_url, init) => {
      calls += 1;
      ranges.push(new Headers(init?.headers).get('content-range') || '');
      return Promise.resolve(calls === 1
        ? new Response(null, { status: 503 })
        : new Response(JSON.stringify({ id: 'drive-id' }), { status: 200 }));
    },
  });
  assertEquals(result.id, 'drive-id');
  assertEquals(ranges, ['bytes 0-1048575/1048576', 'bytes 0-1048575/1048576']);
});

Deno.test('resumable upload handles a file at the configured 25 MB maximum', async () => {
  let calls = 0;
  const size = 25 * 1024 * 1024;
  const result = await uploadResumableChunks({
    sessionUrl: 'https://upload.example/session',
    token: 'test-token',
    bytes: new Uint8Array(size),
    fetcher: (_url, init) => {
      calls += 1;
      const range = new Headers(init?.headers).get('content-range') || '';
      const final = range.endsWith(`-${size - 1}/${size}`);
      return Promise.resolve(new Response(final ? JSON.stringify({ id: 'near-limit' }) : null, { status: final ? 200 : 308 }));
    },
  });
  assertEquals(result.id, 'near-limit');
  assertEquals(calls, 7);
});

Deno.test('resumable upload stops after bounded network retries', async () => {
  let calls = 0;
  await assertRejects(() => uploadResumableChunks({
    sessionUrl: 'https://upload.example/session',
    token: 'test-token',
    bytes: new Uint8Array(10),
    fetcher: () => { calls += 1; return Promise.reject(new Error('network interrupted')); },
  }));
  assertEquals(calls, 3);
});
