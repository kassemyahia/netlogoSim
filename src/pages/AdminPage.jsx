import { Check, Clipboard, Download, KeyRound, LogIn, LogOut, RefreshCw, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { exportAdminCodes, listAdminProjects, recoverAdminCode, rotateAdminCode } from '../services/api';
import { friendlyMessage } from '../services/errors';
import { requireSupabase } from '../services/supabase';

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(null);
  const [copied, setCopied] = useState(false);

  async function loadProjects() {
    setLoading(true); setError('');
    try { setProjects((await listAdminProjects()).projects || []); }
    catch (err) { setError(err.code === 'unauthorized' ? 'هذا الحساب لا يملك صلاحية المسؤول.' : friendlyMessage(err)); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const client = requireSupabase();
    client.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) loadProjects(); else setLoading(false); });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) => [project.id, project.grade, project.subject, project.unit, project.page, project.idea_description, ...(project.members || []).map((member) => member.name)]
      .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [projects, query]);

  async function login(event) {
    event.preventDefault(); setLoading(true); setError('');
    const { data, error: authError } = await requireSupabase().auth.signInWithPassword(credentials);
    if (authError) { setError('تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.'); setLoading(false); return; }
    setSession(data.session); setCredentials((current) => ({ ...current, password: '' })); await loadProjects();
  }

  async function logout() {
    await requireSupabase().auth.signOut(); setSession(null); setProjects([]); setRevealed(null); setError('');
  }

  async function recover(projectId) {
    setBusyId(String(projectId)); setError(''); setRevealed(null);
    try { setRevealed({ projectId, teamCode: (await recoverAdminCode(projectId)).teamCode }); }
    catch (err) { setError(friendlyMessage(err)); }
    finally { setBusyId(''); }
  }

  async function rotate(projectId) {
    if (!window.confirm('سيبطل الكود القديم فوراً. هل تريد إنشاء كود بديل؟')) return;
    setBusyId(String(projectId)); setError(''); setRevealed(null);
    try { setRevealed({ projectId, teamCode: (await rotateAdminCode(projectId)).teamCode }); }
    catch (err) { setError(friendlyMessage(err)); }
    finally { setBusyId(''); }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(revealed.teamCode); setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  }

  async function exportCodes() {
    setError('');
    try {
      const data = await exportAdminCodes();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data.codes, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `bluebits-team-codes-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(friendlyMessage(err)); }
  }

  if (!session) return (
    <main className="shell max-w-xl py-10 sm:py-16">
      <section className="panel sm:p-8"><ShieldCheck className="h-12 w-12 text-blue-400" /><h1 className="mt-4 text-3xl font-black">إدارة المالك</h1><p className="mt-2 text-sm leading-7 text-slate-400">تسجيل الدخول وحده لا يمنح الصلاحية؛ يتحقق الخادم من دور المسؤول في بيانات الحساب الموثوقة.</p>
        {error && <div className="alert-error mt-5">{error}</div>}
        <form onSubmit={login} className="mt-7 space-y-4">
          <label><span className="label">البريد الإلكتروني</span><input className="field" type="email" autoComplete="username" required value={credentials.email} onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))} /></label>
          <label><span className="label">كلمة المرور</span><input className="field" type="password" autoComplete="current-password" required value={credentials.password} onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))} /></label>
          <button className="btn-primary w-full" disabled={loading}>{loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}دخول آمن</button>
        </form>
      </section>
    </main>
  );

  return (
    <main className="shell space-y-6 py-8 sm:py-12">
      <section className="panel flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><h1 className="text-2xl font-black">إدارة أكواد الفرق</h1><p className="mt-1 text-sm text-slate-400">لا تُحفظ الأكواد في المتصفح أو الجداول. كل استعادة أو استبدال مسجل في سجل تدقيق خاص.</p></div><button className="btn-secondary" onClick={exportCodes}><Download className="h-4 w-4" />نسخة احتياطية</button><button className="btn-secondary" onClick={logout}><LogOut className="h-4 w-4" />خروج</button></section>
      {error && <div className="alert-error">{error}</div>}
      {revealed && <section className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5"><p className="text-sm font-bold text-amber-200">كود المشروع {revealed.projectId} — انسخه الآن</p><div className="mt-3 flex min-w-0 items-center gap-3"><code className="min-w-0 flex-1 break-all rounded-xl bg-slate-950 p-3 text-left text-blue-200" dir="ltr">{revealed.teamCode}</code><button className="btn-secondary shrink-0" onClick={copyCode} aria-label="نسخ الكود">{copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}</button></div></section>}
      <label className="panel relative block p-3"><Search className="absolute right-6 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><span className="sr-only">بحث في المشاريع أو الطلاب</span><input className="field pr-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم المشروع، الفكرة، الصف أو اسم الطالب" /></label>
      {loading ? <div className="panel flex items-center justify-center gap-2 py-14 text-blue-200"><RefreshCw className="h-5 w-5 animate-spin" />جارٍ تحميل المشاريع…</div> : <div className="space-y-3">{visible.map((project) => <article key={project.id} className="panel flex flex-col gap-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><p className="text-xs text-blue-300">مشروع {project.id} • {project.grade} • {project.subject} • صفحة {project.page}</p><h2 className="mt-1 break-words text-lg font-bold">{project.idea_description}</h2><p className="mt-2 text-sm text-slate-400">{(project.members || []).map((member) => member.name).join('، ')}</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={busyId === String(project.id) || !project.hasRecoveryRecord} onClick={() => recover(project.id)}><KeyRound className="h-4 w-4" />استعادة</button><button className="btn-primary" disabled={busyId === String(project.id)} onClick={() => rotate(project.id)}>{busyId === String(project.id) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}استبدال الكود</button></div></article>)}</div>}
    </main>
  );
}
