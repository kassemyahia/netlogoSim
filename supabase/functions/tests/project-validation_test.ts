import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { contentOkay, filenameOkay, validMembers, validProjectId } from '../_shared/project-validation.ts';

Deno.test('validates 4–8 complete unique members', () => {
  const valid = ['001','002','003','004'].map((collegeId, i) => ({ name: `Student ${i}`, collegeId }));
  assert(validMembers(valid));
  assertEquals(validMembers(valid.slice(0, 3)), false);
  assertEquals(validMembers([...valid.slice(0, 3), { name: 'Duplicate', collegeId: '001' }]), false);
});

Deno.test('accepts structured .html and rejects alternate extensions/content', () => {
  assert(filenameOkay('netlogo-export.html'));
  assertEquals(filenameOkay('netlogo-export.htm'), false);
  assertEquals(filenameOkay('netlogo-export.nlogo'), false);
  assert(contentOkay(new TextEncoder().encode('<!doctype html><html><body>NetLogo</body></html>')));
  assertEquals(contentOkay(new TextEncoder().encode('PK archive')), false);
});

Deno.test('accepts only canonical positive Postgres bigint project IDs', () => {
  assert(validProjectId('1'));
  assert(validProjectId('9223372036854775807'));
  assertEquals(validProjectId('0'), false);
  assertEquals(validProjectId('01'), false);
  assertEquals(validProjectId('9223372036854775808'), false);
  assertEquals(validProjectId('10000000-0000-0000-0000-000000000001'), false);
});
