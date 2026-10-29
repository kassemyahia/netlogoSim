export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function validateMembers(members) {
  if (!Array.isArray(members) || members.length < 4 || members.length > 8) {
    return 'يجب أن يتكون الفريق من 4 إلى 8 أعضاء.';
  }
  const normalized = members.map((member) => ({
    name: member.name?.trim() || '',
    collegeId: member.collegeId?.trim() || '',
  }));
  if (normalized.some((member) => !member.name || !member.collegeId)) {
    return 'يرجى إدخال الاسم والرقم الجامعي لكل عضو.';
  }
  if (normalized.some((member) => member.name.length > 120 || member.collegeId.length > 40)) {
    return 'أحد حقول أعضاء الفريق أطول من الحد المسموح.';
  }
  if (new Set(normalized.map((member) => member.collegeId)).size !== normalized.length) {
    return 'لا يمكن تكرار الرقم الجامعي ضمن الفريق نفسه.';
  }
  return null;
}

export function validateHtmlFile(file) {
  if (!file) return null;
  if (!/\.html$/i.test(file.name) || /\.htm$/i.test(file.name)) {
    return 'يسمح بملفات HTML ذات الامتداد .html فقط.';
  }
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return `يجب ألا يتجاوز حجم الملف ${MAX_FILE_BYTES / 1024 / 1024} ميغابايت.`;
  }
  return null;
}
