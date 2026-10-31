import { LoaderCircle, ServerCog, UploadCloud, XCircle } from 'lucide-react';

const LABELS = {
  transferring: 'جارٍ نقل الملف إلى الخادم…',
  processing: 'اكتمل النقل. جارٍ التحقق والحفظ في Google Drive…',
  finalizing: 'تم الحفظ. جارٍ تفعيل النسخة وتحديث الواجهة…',
};

export default function UploadProgress({ stage, progress, onCancel }) {
  if (!LABELS[stage]) return null;
  const transferring = stage === 'transferring';
  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-blue-100">
        {transferring ? <UploadCloud className="h-5 w-5 shrink-0" /> : stage === 'processing' ? <ServerCog className="h-5 w-5 shrink-0" /> : <LoaderCircle className="h-5 w-5 shrink-0 animate-spin" />}
        <span className="flex-1">{LABELS[stage]}</span>
        {onCancel && stage === 'transferring' && <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-rose-200" onClick={onCancel}><XCircle className="h-4 w-4" />إلغاء</button>}
      </div>
      {transferring && Number.isFinite(progress) && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-slate-900"><div className="h-full bg-blue-500 transition-[width]" style={{ width: `${progress}%` }} /></div>
          <p className="mt-1 text-left text-xs text-blue-200" dir="ltr">{progress}%</p>
        </div>
      )}
    </div>
  );
}
