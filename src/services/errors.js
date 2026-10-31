const MESSAGES = {
  configuration: 'إعداد الاتصال بقاعدة البيانات غير مكتمل. يرجى إبلاغ مسؤول المنصة.',
  service_not_deployed: 'خدمة التسجيل ورفع الملفات غير مفعّلة بعد. يجب على مسؤول المنصة تطبيق ترحيل قاعدة البيانات ونشر وظائف Supabase.',
  network: 'تعذر الوصول إلى الخدمة. تحقق من اتصال الإنترنت ثم أعد المحاولة.',
  database_read: 'تعذر تحميل البيانات حالياً. يرجى المحاولة بعد قليل.',
  unauthorized: 'كود الفريق غير صحيح أو لا يملك صلاحية الوصول.',
  reservation_taken: 'هذه التجربة محجوزة مسبقاً. اختر تجربة أو صفحة أخرى.',
  rate_limited: 'تم تجاوز عدد المحاولات المسموح. انتظر قليلاً ثم أعد المحاولة.',
  invalid_team: 'بيانات أعضاء الفريق غير مكتملة أو غير صالحة.',
  invalid_request: 'تعذر قبول الطلب. راجع البيانات المدخلة ثم أعد المحاولة.',
  bot_check: 'تعذر التحقق من الحماية الآلية. حدّث الصفحة ثم أعد المحاولة.',
  invalid_file: 'ملف المشروع غير صالح. يسمح بملف HTML صحيح فقط ضمن الحجم المحدد.',
  file_too_large: 'حجم ملف المشروع أكبر من الحد المسموح.',
  no_submission: 'لا يوجد ملف مسلّم لهذا المشروع حتى الآن.',
  google_reauthorization_required: 'انتهى تفويض Google. يجب على مسؤول المنصة إعادة ربط الحساب.',
  google_unavailable: 'خدمة Google غير متاحة مؤقتاً. لم تُفقد بياناتك؛ حاول لاحقاً.',
  code_not_recoverable: 'لا يمكن استعادة هذا الكود القديم، لكن يستطيع المسؤول إنشاء كود بديل.',
  fresh_auth_required: 'سجّل الخروج ثم ادخل مجدداً قبل تصدير النسخة الحساسة.',
  upload_timeout: 'استغرق الرفع وقتاً أطول من المسموح. تحقق من حالة المشروع قبل إعادة المحاولة.',
  upload_in_progress: 'توجد محاولة رفع ما زالت قيد المعالجة. انتظر قليلاً ثم حدّث حالة المشروع.',
  preview_incompatible: 'تعذر تشغيل هذا التصدير ضمن العزل الآمن. قد يعتمد على موارد خارجية محظورة.',
  unavailable: 'تعذر إكمال الطلب الآن. يرجى المحاولة لاحقاً.',
};

export class PortalError extends Error {
  constructor(code = 'unavailable', message) {
    super(message || MESSAGES[code] || MESSAGES.unavailable);
    this.name = 'PortalError';
    this.code = code;
  }
}

export function messageForCode(code, fallback) {
  return MESSAGES[code] || fallback || MESSAGES.unavailable;
}

export function friendlyMessage(error, fallbackCode = 'unavailable') {
  if (error instanceof PortalError) return error.message;
  if (error?.name === 'AbortError') return '';
  return messageForCode(fallbackCode);
}
