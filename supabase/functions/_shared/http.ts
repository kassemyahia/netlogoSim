const allowedOrigins = () => (Deno.env.get('ALLOWED_ORIGINS') || 'https://locallost.me,http://localhost:5173')
  .split(',').map((value) => value.trim()).filter(Boolean);

export function cors(req: Request, origins = allowedOrigins()) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': origins.includes(origin) ? origin : origins[0],
    // supabase-js sends x-client-info on every function invocation. Keep the
    // retry/tracing headers in sync with Supabase's documented browser list.
    'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type, x-request-id, x-retry-count, traceparent, tracestate, baggage, x-owner-setup-secret, x-worker-secret',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-expose-headers': 'sb-error-code, x-request-id',
    vary: 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200) {
  const requestId = req.headers.get('x-request-id');
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(requestId ? { 'x-request-id': requestId } : {}) } });
}

export function friendlyError(req: Request, code: string, status = 400) {
  const messages: Record<string, string> = {
    configuration: 'الخدمة غير مكتملة الإعداد. يرجى إبلاغ مسؤول المنصة.',
    invalid_request: 'الطلب غير صالح.', invalid_team: 'بيانات أعضاء الفريق غير صالحة.',
    reservation_taken: 'هذه التجربة محجوزة مسبقاً.', unauthorized: 'كود الفريق غير صحيح أو لا يملك صلاحية الوصول.',
    rate_limited: 'محاولات كثيرة. يرجى الانتظار ثم المحاولة.', bot_check: 'تعذر التحقق من الحماية. أعد المحاولة.',
    invalid_file: 'الملف غير صالح. يسمح بتصدير HTML فقط.', file_too_large: 'حجم الملف أكبر من الحد المسموح.',
    no_submission: 'لا يوجد ملف مسلّم لهذا المشروع.', google_reauthorization_required: 'انتهى تفويض Google أو ألغي. يجب على المسؤول إعادة الربط.',
    google_unavailable: 'خدمة Google غير متاحة مؤقتاً. لم يُفقد الحجز؛ حاول لاحقاً.',
    code_not_recoverable: 'لا يمكن استعادة هذا الكود، لكن يمكن للمسؤول إنشاء كود بديل.',
    fresh_auth_required: 'يلزم تسجيل الدخول مجدداً قبل تنفيذ هذا الإجراء الحساس.',
    upload_timeout: 'استغرق الرفع وقتاً أطول من المسموح. تحقق من حالة المشروع قبل إعادة المحاولة.',
    upload_in_progress: 'توجد محاولة رفع بنفس الطلب ما زالت قيد المعالجة. انتظر قليلاً ثم تحقق من حالة المشروع.',
  };
  return json(req, { ok: false, code, error: messages[code] || messages.invalid_request }, status);
}

export function getClientAddress(req: Request) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
