import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Download, Eye, Lock, RefreshCw, Search, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadProject, getProjectMembers, upgradeLegacyCode, uploadProject } from '../../services/api';
import { friendlyMessage } from '../../services/errors';
import { validateHtmlFile } from '../../utils/validation';

const COLLATOR = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });
const SORT_COLUMNS = [
  { key: 'idea_description', label: 'فكرة المشروع' },
  { key: 'grade', label: 'الصف' },
  { key: 'subject', label: 'الكتاب' },
  { key: 'unit', label: 'الوحدة' },
  { key: 'page', label: 'رقم الصفحة' },
];

function SortHeader({ column, sort, onSort }) {
  const selected = sort.key === column.key;
  return (
    <th scope="col" className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-slate-200">
      <span className="inline-flex items-center gap-2">
        {column.label}
        <span className="inline-flex overflow-hidden rounded-lg border border-slate-700 bg-slate-950/70">
          <button
            type="button"
            className={`grid h-8 w-8 place-items-center transition hover:bg-blue-500/20 ${selected && sort.direction === 'asc' ? 'bg-blue-500/25 text-blue-200' : 'text-slate-400'}`}
            onClick={() => onSort(column.key, 'asc')}
            aria-label={`ترتيب ${column.label} تصاعدياً`}
            aria-pressed={selected && sort.direction === 'asc'}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={`grid h-8 w-8 place-items-center border-r border-slate-700 transition hover:bg-blue-500/20 ${selected && sort.direction === 'desc' ? 'bg-blue-500/25 text-blue-200' : 'text-slate-400'}`}
            onClick={() => onSort(column.key, 'desc')}
            aria-label={`ترتيب ${column.label} تنازلياً`}
            aria-pressed={selected && sort.direction === 'desc'}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </span>
      </span>
    </th>
  );
}

export default function ProjectsTable({ projects, onProjectUpdated }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'idea_description', direction: 'asc' });
  const [dialog, setDialog] = useState(null);
  const [teamCode, setTeamCode] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [membersBusy, setMembersBusy] = useState(false);
  const [members, setMembers] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [upgradedCode, setUpgradedCode] = useState('');
  const closeRef = useRef(null);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...projects]
      .filter((project) => [project.grade, project.subject, project.unit, project.page, project.idea_description]
        .some((value) => String(value || '').toLowerCase().includes(normalized)))
      .sort((first, second) => direction * COLLATOR.compare(String(first[sort.key] || ''), String(second[sort.key] || '')));
  }, [projects, query, sort]);

  useEffect(() => {
    if (!dialog) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape' && !busy && !membersBusy) setDialog(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, busy, membersBusy]);

  function open(project, action) {
    setDialog({ project, action });
    setTeamCode('');
    setFile(null);
    setUpgradedCode('');
    setMembers(null);
    setMembersBusy(false);
    setMessage({ type: '', text: '' });
  }

  function changeDialogAction(action) {
    setDialog((current) => ({ ...current, action }));
    setTeamCode('');
    setFile(null);
    setUpgradedCode('');
    setMembers(null);
    setMembersBusy(false);
    setMessage({ type: '', text: '' });
  }

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

  async function revealMembers(event) {
    event.preventDefault();
    if (!teamCode.trim() || membersBusy) return setMessage({ type: 'error', text: 'أدخل كود الفريق السري.' });
    setMembersBusy(true); setMessage({ type: '', text: '' });
    try {
      const data = await getProjectMembers(dialog.project.id, teamCode.trim());
      setMembers(data.members || []);
      setMessage({ type: 'success', text: 'تم التحقق من الكود وعرض أعضاء الفريق.' });
    } catch (err) { setMessage({ type: 'error', text: friendlyMessage(err) }); }
    finally { setMembersBusy(false); }
  }

  const title = dialog?.action === 'details' ? 'تفاصيل المشروع' : dialog?.action === 'upload' ? 'رفع ملف HTML خاص' : 'تنزيل الملف الخاص';

  return <div className="min-w-0 space-y-4">
    <label className="panel relative block p-3"><span className="sr-only">بحث في المشاريع</span><Search className="absolute right-6 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input className="field pr-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بفكرة المشروع، الصف، الكتاب، الوحدة أو رقم الصفحة" /></label>
    {visible.length === 0 ? <div className="panel py-14 text-center text-slate-400">لا توجد مشاريع مطابقة.</div> : (
      <div className="panel min-w-0 p-0">
        <div className="max-w-full overflow-x-auto rounded-2xl" role="region" aria-label="جدول المشاريع" tabIndex="0">
          <table className="w-full min-w-[1000px] border-collapse text-right">
            <thead className="bg-slate-950/70">
              <tr className="border-b border-slate-800">
                {SORT_COLUMNS.map((column) => <SortHeader key={column.key} column={column} sort={sort} onSort={(key, direction) => setSort({ key, direction })} />)}
                <th scope="col" className="px-4 py-3 text-right text-sm font-bold text-slate-200">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((project) => (
                <tr key={project.id} className="border-b border-slate-800/80 align-top last:border-0 hover:bg-blue-500/[0.04]">
                  <td className="max-w-sm px-4 py-4 text-sm leading-6 text-slate-200"><p className="break-words">{project.idea_description}</p></td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-300">{project.grade}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold text-blue-200">{project.subject}</td>
                  <td className="max-w-52 px-4 py-4 text-sm text-slate-300"><span className="break-words">{project.unit}</span></td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-300">{project.page}</td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-64 gap-2">
                      <button className="btn-primary flex-1 px-3" onClick={() => open(project, 'upload')}><Upload className="h-4 w-4" />{project.is_submitted ? 'استبدال الملف' : 'رفع الملف'}</button>
                      <button className="btn-secondary flex-1 px-3" onClick={() => open(project, 'details')}><Eye className="h-4 w-4" />عرض التفاصيل</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {dialog && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy && !membersBusy) setDialog(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" className="max-h-[min(90dvh,680px)] w-full overflow-y-auto rounded-t-2xl border border-slate-700 bg-[#0b1220] p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6">
        <header className="flex items-center justify-between gap-3"><h2 id="project-dialog-title" className="flex items-center gap-2 text-lg font-bold">{dialog.action === 'details' ? <Eye className="h-5 w-5 text-blue-400" /> : <Lock className="h-5 w-5 text-blue-400" />}{title}</h2><button ref={closeRef} className="btn-secondary px-3" onClick={() => setDialog(null)} disabled={busy || membersBusy} aria-label="إغلاق"><X className="h-5 w-5" /></button></header>

        {dialog.action === 'details' ? (
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-bold text-blue-300">فكرة المشروع</p>
              <p className="mt-2 break-words text-sm leading-7 text-slate-200">{dialog.project.idea_description}</p>
            </div>
            <dl className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">الصف</dt><dd className="mt-1 text-sm text-slate-200">{dialog.project.grade}</dd></div>
              <div><dt className="text-xs text-slate-500">الكتاب</dt><dd className="mt-1 text-sm text-slate-200">{dialog.project.subject}</dd></div>
              <div><dt className="text-xs text-slate-500">الوحدة</dt><dd className="mt-1 break-words text-sm text-slate-200">{dialog.project.unit}</dd></div>
              <div><dt className="text-xs text-slate-500">رقم الصفحة</dt><dd className="mt-1 text-sm text-slate-200">{dialog.project.page}</dd></div>
              <div><dt className="text-xs text-slate-500">حالة التسليم</dt><dd className={`mt-1 text-sm font-bold ${dialog.project.is_submitted ? 'text-emerald-300' : 'text-amber-300'}`}>{dialog.project.is_submitted ? 'تم التسليم' : 'بانتظار الملف'}</dd></div>
              <div><dt className="text-xs text-slate-500">تاريخ التسجيل</dt><dd className="mt-1 text-sm text-slate-200">{dialog.project.created_at ? new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium' }).format(new Date(dialog.project.created_at)) : 'غير متاح'}</dd></div>
            </dl>
            <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-4" aria-labelledby="team-members-title">
              <h3 id="team-members-title" className="font-bold text-slate-100">أعضاء الفريق</h3>
              {members === null ? (
                <>
                  <p className="mt-2 text-sm leading-6 text-slate-400">أسماء الطلاب خاصة. أدخل كود الفريق السري لعرض كل طالب بشكل منفصل.</p>
                  {message.text && <div className={`mt-4 flex gap-2 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}><AlertTriangle className="h-4 w-4 shrink-0" />{message.text}</div>}
                  <form onSubmit={revealMembers} className="mt-4 space-y-3">
                    <label><span className="label">كود الفريق السري</span><input className="field font-mono" type="password" autoComplete="off" required value={teamCode} onChange={(event) => setTeamCode(event.target.value)} /></label>
                    <button className="btn-primary w-full" disabled={membersBusy}>{membersBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}عرض أعضاء الفريق</button>
                  </form>
                </>
              ) : (
                <ol className="mt-3 space-y-2">
                  {members.map((member) => <li key={member.position} className="flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-300">{member.position}</span><span className="break-words">{member.name}</span></li>)}
                </ol>
              )}
            </section>
            {dialog.project.is_submitted && <button type="button" className="btn-secondary w-full" onClick={() => changeDialogAction('download')}><Download className="h-4 w-4" />تنزيل الملف الخاص</button>}
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-400">تتحقق الخدمة من ملكية الفريق قبل قراءة الملف أو رفع أي بايت إلى Google Drive.</p>
            {message.text && <div className={`mt-4 flex gap-2 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>{message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}{message.text}</div>}
            {upgradedCode && <code className="mt-3 block break-all rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 text-center text-blue-200" dir="ltr">{upgradedCode}</code>}
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label><span className="label">كود الفريق السري</span><input className="field font-mono" type="password" autoComplete="off" required value={teamCode} onChange={(event) => setTeamCode(event.target.value)} /></label>
              {dialog.action === 'upload' && <label><span className="label">ملف .html فقط</span><input className="field file:ml-2 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white" type="file" accept=".html,text/html" required onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>}
              <button className="btn-primary w-full" disabled={busy}>{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : dialog.action === 'upload' ? <Upload className="h-4 w-4" /> : <Download className="h-4 w-4" />}{dialog.action === 'upload' ? 'رفع الملف' : 'تنزيل الملف'}</button>
              <button className="w-full text-sm font-bold text-blue-300 underline" type="button" onClick={upgrade} disabled={busy}>لدي كود قديم قصير — تحديثه بأمان</button>
            </form>
          </>
        )}
      </section>
    </div>}
  </div>;
}
