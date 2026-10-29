import { PlusCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProjectsTable from '../components/ui/ProjectsTable';
import { listProjects } from '../services/api';
import { friendlyMessage } from '../services/errors';

const GRADES = { 7: 'الصف السابع', 8: 'الصف الثامن', 9: 'الصف التاسع' };
const TABS = ['الكل', 'الرياضيات', 'العلوم', 'الفيزياء والكيمياء'];

export default function GradePage() {
  const { gradeSlug } = useParams();
  const gradeName = GRADES[gradeSlug] || GRADES[7];
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('الكل');
  const requestRef = useRef(0);

  const load = useCallback(async (signal) => {
    const requestId = ++requestRef.current;
    setLoading(true); setError('');
    try {
      const result = await listProjects(gradeName, signal);
      if (requestId === requestRef.current) setProjects(result);
    } catch (err) {
      if (requestId === requestRef.current && err.name !== 'AbortError') setError(friendlyMessage(err, 'database_read'));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [gradeName]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => { controller.abort(); requestRef.current += 1; };
  }, [load]);
  const visible = tab === 'الكل' ? projects : projects.filter((project) => project.subject === tab);

  return (
    <main className="shell space-y-6 py-8">
      <header className="panel flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div><p className="text-sm text-blue-300">المشاريع المحجوزة</p><h1 className="text-2xl font-black sm:text-3xl">{gradeName}</h1></div>
        <div className="flex flex-wrap gap-2"><Link className="btn-primary" to="/register"><PlusCircle className="h-4 w-4" />تسجيل مشروع</Link><button className="btn-secondary" onClick={() => load()} disabled={loading} aria-label="تحديث"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
      </header>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="تصفية حسب المادة">
        {TABS.map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={tab === item ? 'btn-primary' : 'btn-secondary'}>{item}</button>)}
      </div>
      {error && <div className="alert-error" role="alert">{error}</div>}
      {loading ? <div className="panel py-16 text-center"><RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-400" /><p className="mt-3 text-slate-300">جاري تحميل المشاريع...</p></div> : <ProjectsTable projects={visible} onProjectUpdated={load} />}
    </main>
  );
}
