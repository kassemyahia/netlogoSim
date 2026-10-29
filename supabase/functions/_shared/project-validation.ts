export const GRADES = new Set(['الصف السابع', 'الصف الثامن', 'الصف التاسع']);
export const SUBJECTS = new Set(['الرياضيات', 'العلوم', 'الفيزياء والكيمياء']);

export function safeText(value: unknown, max: number) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }
export function validMembers(value: unknown): value is Array<{ name: string; collegeId: string }> {
  if (!Array.isArray(value) || value.length < 4 || value.length > 8) return false;
  if (value.some((member) => !member || !safeText(member.name, 120) || !safeText(member.collegeId, 40))) return false;
  return new Set(value.map((member) => member.collegeId.trim())).size === value.length;
}
export function filenameOkay(name: string) { return name.length <= 180 && /^[^\0/\\]+\.html$/iu.test(name) && !/\.htm$/iu.test(name); }
export function contentOkay(bytes: Uint8Array) {
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 65536))).replace(/^\uFEFF/, '').trimStart().toLowerCase();
  return !bytes.includes(0) && (head.startsWith('<!doctype html') || head.startsWith('<html')) && head.includes('<html') && head.includes('<body');
}
