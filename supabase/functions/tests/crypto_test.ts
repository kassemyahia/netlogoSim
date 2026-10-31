import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decryptSecret, encryptSecret, signState, verifyState } from '../_shared/crypto.ts';

Deno.test('OAuth state round-trips and rejects tampering', async () => {
  const secret = 'test-only-state-secret-with-enough-entropy';
  const state = await signState({ exp: 1234, nonce: 'nonce' }, secret);
  assertEquals(await verifyState(state, secret), { exp: 1234, nonce: 'nonce' });
  assertEquals(await verifyState(`${state.slice(0, -1)}x`, secret), null);
  assertEquals(await verifyState('invalid', secret), null);
});

Deno.test('encrypted refresh token round-trips', async () => {
  const key = 'test-only-encryption-key-with-enough-entropy';
  const encrypted = await encryptSecret('refresh-token-value', key);
  assertEquals(await decryptSecret(encrypted.encrypted, encrypted.iv, key), 'refresh-token-value');
});
