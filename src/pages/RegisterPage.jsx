import { AlertTriangle, Check, CheckCircle2, Copy, PlusCircle, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { registerProject, uploadProject } from '../services/api';
import { friendlyMessage } from '../services/errors';
import { validateHtmlFile, validateMembers } from '../utils/validation';

const GRADES = ['الصف السابع', 'الصف الثامن', 'الصف التاسع'];
const SUBJECTS = ['الرياضيات', 'العلوم', 'الفيزياء والكيمياء'];
const EMPTY_MEMBER = () => ({ name: '', collegeId: '' });

export default function RegisterPage() {
  const [members, setMembers] = useState(Array.from({ length: 4 }, EMPTY_MEMBER));
  const [fields, setFields] = useState({ grade: GRADES[0], subject: SUBJECTS[0], unit: '', page: '', ideaDescription: '' });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const submitLock = useRef(false);
  const requestId = useRef(crypto.randomUUID());

  const updateMember = (index, key, value) => { setError(''); setMembers((current) => current.map((member, i) => i === index ? { ...member, [key]: value } : member)); };
  const updateField = (event) => { setError(''); setFields((current) => ({ ...current, [event.target.name]: event.target.value })); };

  async function submit(event) {
    event.preventDefault();
    if (submitLock.current) return;
    setError('');
    const memberError = validateMembers(members);
    const fileError = validateHtmlFile(file);
    if (memberError || fileError || !Number.isInteger(Number(fields.page)) || Number(fields.page) <= 0) {
      setError(memberError || fileError || 'رقم الصفحة يجب أن يكون عدداً صحيحاً موجباً.'); return;
    }
    submitLock.current = true; setSubmitting(true);
    try {
      const registered = await registerProject({
        members: members.map((member) => ({ name: member.name.trim(), collegeId: member.collegeId.trim() })),
        ...fields,
        page: Number(fields.page),
        turnstileToken: event.currentTarget.elements.turnstileToken?.value || null,
        requestId: requestId.current,
      });
      const next = { projectId: registered.projectId, teamCode: registered.teamCode, upload: file ? 'uploading' : 'none', uploadError: '' };
      setResult(next);
      if (file) {
        try {
          await uploadProject({ projectId: registered.projectId, teamCode: registered.teamCode, file });
          setResult({ ...next, upload: 'done' });
        } catch (uploadError) {
          setResult({ ...next, upload: 'failed', uploadError: friendlyMessage(uploadError) });
        }
      }
    } catch (err) { setError(friendlyMessage(err)); }
    finally { submitLock.current = false; setSubmitting(false); }
  }

  async function retryUpload() {
    if (!result || !file || submitting) return;
    setSubmitting(true); setResult((current) => ({ ...current, upload: 'uploading', uploadError: '' }));
    try { await uploadProject({ projectId: result.projectId, teamCode: result.teamCode, file }); setResult((current) => ({ ...current, upload: 'done' })); }
    catch (err) { setResult((current) => ({ ...current, upload: 'failed', uploadError: friendlyMessage(err) })); }
    finally { setSubmitting(false); }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(result.teamCode); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError('تعذر نسخ الكود تلقائياً. حدده وانسخه يدوياً.'); }
  }

  if (result) return (
    <main className="shell max-w-3xl py-10">
      <section className="panel text-center sm:p-10">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
        <h1 className="mt-4 text-2xl font-black">تم حجز المشروع بنجاح</h1>
        <p className="mt-2 text-sm leading-7 text-slate-300">احفظ الكود الآن. لن يظهر في القوائم العامة ولا يمكن استعادته من المنصة.</p>
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-blue-500/40 bg-blue-500/10 p-4">
          <p className="text-xs text-slate-300">كود الفريق السري</p>
          <div className="mt-2 flex min-w-0 items-center justify-center gap-2"><code className="min-w-0 break-all text-xl font-black tracking-wider text-blue-200" dir="ltr">{result.teamCode}</code><button onClick={copyCode} className="btn-secondary shrink-0" aria-label="نسخ كود الفريق">{copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</button></div>
        </div>
        {result.upload === 'uploading' && <p className="mt-5 text-blue-200">جاري رفع الملف الخاص...</p>}
        {result.upload === 'done' && <div className="alert-success mt-5">تم رفع ملف HTML الخاص بنجاح.</div>}
        {result.upload === 'failed' && <div className="mt-5 space-y-3"><div className="alert-error">تم حفظ الحجز والكود، لكن تعذر رفع الملف: {result.uploadError}</div><button className="btn-primary" onClick={retryUpload} disabled={submitting}><Upload className="h-4 w-4" />إعادة محاولة الرفع</button></div>}
        {error && <div className="alert-error mt-4">{error}</div>}
        <Link to={`/grade/${GRADES.indexOf(fields.grade) + 7}`} className="btn-secondary mt-6">عرض المشاريع</Link>
      </section>
    </main>
  );

  return (
    <main className="shell max-w-4xl py-8 sm:py-12">
      <section className="panel sm:p-8">
        <h1 className="text-2xl font-black sm:text-3xl">تسجيل فريق وحجز تجربة</h1>
        <p className="mt-2 text-sm text-slate-400">أدخل 4–8 أعضاء. تبقى الأسماء والأرقام الجامعية خاصة.</p>
        {error && <div className="alert-error mt-5 flex items-start gap-2" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        <form onSubmit={submit} className="mt-8 space-y-8">
          <fieldset className="space-y-3"><legend className="label">أعضاء الفريق</legend>
            {members.map((member, index) => <div key={index} className="grid min-w-0 gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:grid-cols-[32px_minmax(0,1fr)_minmax(0,220px)_44px] sm:items-center">
              <span className="text-center text-sm text-slate-500">{index + 1}</span>
              <label className="min-w-0"><span className="sr-only">اسم العضو {index + 1}</span><input className="field" required maxLength="120" autoComplete="name" placeholder="الاسم الكامل" value={member.name} onChange={(e) => updateMember(index, 'name', e.target.value)} /></label>
              <label className="min-w-0"><span className="sr-only">الرقم الجامعي للعضو {index + 1}</span><input className="field font-mono" required maxLength="40" inputMode="numeric" placeholder="الرقم الجامعي" value={member.collegeId} onChange={(e) => updateMember(index, 'collegeId', e.target.value)} /></label>
              {members.length > 4 ? <button type="button" className="btn-secondary px-3 text-rose-300" onClick={() => { setError(''); setMembers((current) => current.filter((_, i) => i !== index)); }} aria-label={`حذف العضو ${index + 1}`}><Trash2 className="h-4 w-4" /></button> : <span />}
            </div>)}
            {members.length < 8 && <button type="button" className="btn-secondary" onClick={() => { setError(''); setMembers((current) => [...current, EMPTY_MEMBER()]); }}><PlusCircle className="h-4 w-4" />إضافة عضو</button>}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">الصف</span><select className="field" name="grade" value={fields.grade} onChange={updateField}>{GRADES.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span className="label">المادة</span><select className="field" name="subject" value={fields.subject} onChange={updateField}>{SUBJECTS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span className="label">الوحدة</span><input className="field" name="unit" required maxLength="160" value={fields.unit} onChange={updateField} /></label>
            <label><span className="label">رقم الصفحة</span><input className="field" name="page" type="number" min="1" max="10000" required value={fields.page} onChange={updateField} /></label>
          </div>
          <label><span className="label">وصف التجربة</span><textarea className="field min-h-28 resize-y" name="ideaDescription" required maxLength="2000" value={fields.ideaDescription} onChange={updateField} /></label>
          <label><span className="label">ملف المشروع HTML (اختياري)</span><input className="field file:ml-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white" type="file" accept=".html,text/html" onChange={(e) => { const next = e.target.files?.[0] || null; setFile(next); setError(validateHtmlFile(next) || ''); }} /><span className="mt-2 block text-xs leading-6 text-slate-400">الحد الأقصى 25 ميغابايت. ملفات HTML قد تحتوي شيفرة تنفيذية؛ تُحفظ خاصة ولا تُشغّل داخل البوابة.</span></label>
          <button className="btn-primary w-full sm:w-auto" type="submit" disabled={submitting}>{submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}تأكيد الحجز</button>
        </form>
      </section>
    </main>
  );
}
