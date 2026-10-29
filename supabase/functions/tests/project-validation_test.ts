import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { contentOkay, filenameOkay, validMembers } from '../_shared/project-validation.ts';

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
