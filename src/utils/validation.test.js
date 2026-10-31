import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, validateHtmlFile, validateMembers } from './validation';

const members = (ids) => ids.map((collegeId, index) => ({ name: `طالب ${index}`, collegeId }));

describe('team validation', () => {
  it('requires 4–8 complete members', () => {
    expect(validateMembers(members(['1', '2', '3']))).toBeTruthy();
    expect(validateMembers([...members(['1', '2', '3']), { name: '', collegeId: '4' }])).toBeTruthy();
    expect(validateMembers(members(['1', '2', '3', '4']))).toBeNull();
  });

  it('rejects duplicate university IDs but preserves strings', () => {
    expect(validateMembers(members(['001', '002', '001', '004']))).toMatch(/تكرار/);
    expect(validateMembers(members(['001', '002', '003', '004']))).toBeNull();
  });
});

describe('file validation', () => {
  it('accepts only bounded .html files', () => {
    expect(validateHtmlFile({ name: 'model.html', size: 100 })).toBeNull();
    expect(validateHtmlFile({ name: 'model.nlogo', size: 100 })).toBeTruthy();
    expect(validateHtmlFile({ name: 'model.htm', size: 100 })).toBeTruthy();
    expect(validateHtmlFile({ name: 'model.html', size: 1024 * 1024 })).toBeNull();
    expect(validateHtmlFile({ name: 'Ants.html', size: 7_400_000 })).toBeNull();
    expect(validateHtmlFile({ name: 'near-limit.html', size: MAX_FILE_BYTES })).toBeNull();
    expect(validateHtmlFile({ name: 'model.html', size: MAX_FILE_BYTES + 1 })).toBeTruthy();
  });
});
