import { AlertTriangle, CheckCircle2, Download, Lock, RefreshCw, Search, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadProject, upgradeLegacyCode, uploadProject } from '../../services/api';
import { friendlyMessage } from '../../services/errors';
import { validateHtmlFile } from '../../utils/validation';

export default function ProjectsTable({ projects, onProjectUpdated }) {
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null);
  const [teamCode, setTeamCode] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [upgradedCode, setUpgradedCode] = useState('');
  const closeRef = useRef(null);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...projects]
      .filter((project) => [project.team_label, project.subject, project.unit, project.page, project.idea_description].some((value) => String(value || '').toLowerCase().includes(normalized)))
      .sort((a, b) => Number(a.page) - Number(b.page));
  }, [projects, query]);

  useEffect(() => {
    if (!dialog) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape' && !busy) setDialog(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, busy]);

  function open(project, action) { setDialog({ project, action }); setTeamCode(''); setFile(null); setUpgradedCode(''); setMessage({ type: '', text: '' }); }

  async function upgrade() {
    if (!teamCode.trim() || busy) return setMessage({ type: 'error', text: 'أدخل كود الفريق القديم أولاً.' });
    setBusy(true); setMessage({ type: '', text: '' });
    try {
      const data = await upgradeLegacyCode(dialog.project.id, teamCode.trim(), crypto.randomUUID());
      setUpgradedCode(data.teamCode); setTeamCode(data.teamCode);
      setMessage({ type: 'success', text: 'تم تحديث الكود. انسخ الكود الجديد واحفظه قبل المتابعة.' });
    } catch (err) { setMessage({ type: 'error', text: friendlyMessage(err) }); }
    finally { setBusy(false); }
  }

  async function submit(event) {
    event.preventDefault();
    if (!teamCode.trim()) return setMessage({ type: 'error', text: 'أدخل كود الفريق السري.' });
    const fileError = dialog.action === 'upload' ? validateHtmlFile(file) || (!file ? 'اختر ملف HTML.' : '') : '';
    if (fileError) return setMessage({ type: 'error', text: fileError });
    setBusy(true); setMessage({ type: '', text: '' });
    try {
      if (dialog.action === 'upload') {
        await uploadProject({ projectId: dialog.project.id, teamCode: teamCode.trim(), file });
        setMessage({ type: 'success', text: 'تم رفع النسخة الجديدة بنجاح.' });
        await onProjectUpdated?.();
      } else {
        const { blob, filename } = await downloadProject({ projectId: dialog.project.id, teamCode: teamCode.trim() });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage({ type: 'success', text: 'بدأ تنزيل الملف الخاص.' });
      }
    } catch (err) { setMessage({ type: 'error', text: friendlyMessage(err) }); }
    finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <label className="panel relative block p-3"><span className="sr-only">بحث في المشاريع</span><Search className="absolute right-6 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input className="field pr-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالمادة، الوحدة، الصفحة، الوصف أو اسم الفريق العام" /></label>
    {visible.length === 0 ? <div className="panel py-14 text-center text-slate-400">لا توجد مشاريع مطابقة.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((project) => <article key={project.id} className="panel flex min-w-0 flex-col">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-blue-300">{project.team_label || 'فريق مسجل'}</p><h2 className="mt-1 break-words text-xl font-bold">{project.subject}</h2></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${project.is_submitted ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{project.is_submitted ? 'تم التسليم' : 'بانتظار الملف'}</span></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">الوحدة</dt><dd className="break-words text-slate-200">{project.unit}</dd></div><div><dt className="text-slate-500">الصفحة</dt><dd className="text-slate-200">{project.page}</dd></div></dl>
        <p className="mt-4 flex-1 break-words text-sm leading-7 text-slate-300">{project.idea_description}</p>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-800 pt-4"><button className="btn-primary flex-1" onClick={() => open(project, 'upload')}><Upload className="h-4 w-4" />{project.is_submitted ? 'استبدال الملف' : 'رفع الملف'}</button>{project.is_submitted && <button className="btn-secondary flex-1" onClick={() => open(project, 'download')}><Download className="h-4 w-4" />تنزيل خاص</button>}</div>
      </article>)}
    </div>}
    {dialog && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setDialog(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" className="max-h-[min(90dvh,680px)] w-full overflow-y-auto rounded-t-2xl border border-slate-700 bg-[#0b1220] p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <header className="flex items-center justify-between gap-3"><h2 id="project-dialog-title" className="flex items-center gap-2 text-lg font-bold"><Lock className="h-5 w-5 text-blue-400" />{dialog.action === 'upload' ? 'رفع ملف HTML خاص' : 'تنزيل الملف الخاص'}</h2><button ref={closeRef} className="btn-secondary px-3" onClick={() => setDialog(null)} disabled={busy} aria-label="إغلاق"><X className="h-5 w-5" /></button></header>
        <p className="mt-3 text-sm leading-6 text-slate-400">تتحقق الخدمة من ملكية الفريق قبل قراءة الملف أو رفع أي بايت إلى Google Drive.</p>
        {message.text && <div className={`mt-4 flex gap-2 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>{message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}{message.text}</div>}
        {upgradedCode && <code className="mt-3 block break-all rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 text-center text-blue-200" dir="ltr">{upgradedCode}</code>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label><span className="label">كود الفريق السري</span><input className="field font-mono" type="password" autoComplete="off" required value={teamCode} onChange={(e) => setTeamCode(e.target.value)} /></label>
          {dialog.action === 'upload' && <label><span className="label">ملف .html فقط</span><input className="field file:ml-2 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white" type="file" accept=".html,text/html" required onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : dialog.action === 'upload' ? <Upload className="h-4 w-4" /> : <Download className="h-4 w-4" />}{dialog.action === 'upload' ? 'رفع الملف' : 'تنزيل الملف'}</button>
          <button className="w-full text-sm font-bold text-blue-300 underline" type="button" onClick={upgrade} disabled={busy}>لدي كود قديم قصير — تحديثه بأمان</button>
        </form>
      </section>
    </div>}
  </div>;
}
