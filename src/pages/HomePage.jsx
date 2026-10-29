import { ArrowLeft, BookOpen, GraduationCap, PlusCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { countProjects } from '../services/api';
import { friendlyMessage } from '../services/errors';

const GRADES = ['السابع', 'الثامن', 'التاسع'];

export default function HomePage() {
  const [count, setCount] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    countProjects(controller.signal).then((value) => {
      setCount(value);
      setError('');
    }).catch((err) => {
      if (err.name !== 'AbortError') setError(friendlyMessage(err, 'database_read'));
    });
    return () => controller.abort();
  }, []);

  return (
    <main className="pb-16">
      <section className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_right,_#173e70,_#070c16_55%)] py-16 sm:py-24">
        <div className="shell grid items-center gap-10 lg:grid-cols-[1fr_300px]">
          <div>
            <p className="mb-3 text-sm font-bold text-blue-300">فريق BlueBits • النمذجة والمحاكاة</p>
            <h1 className="max-w-4xl text-3xl font-black leading-tight sm:text-5xl">منصة مشاريع NetLogo للمناهج الدراسية</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">اختر تجربة، احجزها لفريقك، ثم ارفع تصدير NetLogo بصيغة HTML بصورة خاصة وآمنة.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn-primary" to="/register"><PlusCircle className="h-5 w-5" />تسجيل مشروع</Link>
              <Link className="btn-secondary" to="/books"><BookOpen className="h-5 w-5" />مكتبة الكتب</Link>
            </div>
          </div>
          <aside className="panel text-center" aria-live="polite">
            <p className="text-sm text-slate-400">المشاريع المسجلة</p>
            {count === null && !error && <RefreshCw className="mx-auto mt-4 h-7 w-7 animate-spin text-blue-400" />}
            {count !== null && <p className="mt-2 text-5xl font-black text-blue-300">{count}</p>}
            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          </aside>
        </div>
      </section>

      <section className="shell py-12">
        <h2 className="text-2xl font-black">استعراض المشاريع حسب الصف</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {GRADES.map((name, index) => (
            <Link key={name} to={`/grade/${index + 7}`} className="panel group flex min-h-52 flex-col justify-between transition hover:border-blue-500">
              <GraduationCap className="h-11 w-11 text-blue-400" />
              <div><h3 className="text-2xl font-bold">الصف {name}</h3><span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-blue-300">عرض الحجوزات <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" /></span></div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
