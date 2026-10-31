import { AlertTriangle, Expand, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fetchProjectPreview } from '../../services/api';
import { friendlyMessage } from '../../services/errors';
import { hardenPreviewHtml } from '../../utils/preview';

export default function ProjectPreviewModal({ project, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', url: '' });
  const viewerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setState({ loading: true, error: '', url: '' });
    fetchProjectPreview(project.id, controller.signal)
      .then((html) => {
        objectUrl = URL.createObjectURL(new Blob([hardenPreviewHtml(html)], { type: 'text/html' }));
        setState({ loading: false, error: '', url: objectUrl });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ loading: false, error: friendlyMessage(error), url: '' });
      });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [project.id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-5" role="presentation">
      <section ref={viewerRef} role="dialog" aria-modal="true" aria-labelledby="preview-title" className="flex h-[94dvh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#07101f] shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-3 sm:p-4">
          <div className="min-w-0 flex-1"><h2 id="preview-title" className="truncate font-black">معاينة المشروع</h2><p className="truncate text-xs text-slate-400">{project.idea_description}</p></div>
          <button className="btn-secondary px-3" type="button" onClick={() => viewerRef.current?.requestFullscreen?.()}><Expand className="h-4 w-4" />توسيع</button>
          <button className="btn-secondary px-3" type="button" onClick={onClose} aria-label="إغلاق المعاينة"><X className="h-5 w-5" /></button>
        </header>
        <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-400">الفريق: {(project.members || []).map((member) => member.name).join('، ') || 'غير مسجل'}</div>
        <div className="relative min-h-0 flex-1 bg-white">
          {state.loading && <div className="absolute inset-0 grid place-items-center bg-slate-950 text-blue-200"><div className="flex items-center gap-2"><LoaderCircle className="h-5 w-5 animate-spin" />جارٍ تحميل المعاينة الآمنة…</div></div>}
          {state.error && <div className="absolute inset-0 grid place-items-center bg-slate-950 p-6"><div className="alert-error max-w-lg"><AlertTriangle className="h-5 w-5 shrink-0" />{state.error}</div></div>}
          {state.url && <iframe title={`معاينة ${project.idea_description}`} src={state.url} sandbox="allow-scripts" allow="fullscreen" className="h-full w-full border-0" referrerPolicy="no-referrer" />}
        </div>
        <p className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">تعمل المعاينة داخل إطار معزول بلا وصول إلى حسابك أو صفحة البوابة أو الشبكة. قد لا تعمل التصديرات التي تعتمد على ملفات خارجية.</p>
      </section>
    </div>
  );
}
