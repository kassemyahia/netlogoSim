import { ArrowLeft, BookOpen, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BOOKS_BY_GRADE, GRADE_NAMES } from '../config/books';

export default function BooksPage() {
  return (
    <main className="shell space-y-8 py-8 sm:py-12">
      <section className="panel bg-gradient-to-l from-blue-950 to-slate-950 sm:p-8">
        <p className="mb-2 text-sm font-bold text-blue-300">مكتبة المناهج الرسمية</p>
        <h1 className="text-2xl font-black sm:text-4xl">اختر الصف الدراسي</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">تضم المكتبة أحد عشر كتاباً موزعة حسب الصف. اختر صفاً للوصول إلى كتبه.</p>
      </section>

      <section className="grid gap-5 md:grid-cols-3" aria-label="الصفوف الدراسية">
        {Object.entries(GRADE_NAMES).map(([grade, name]) => (
          <Link key={grade} to={`/books/${grade}`} className="panel group flex min-h-56 min-w-0 flex-col justify-between transition hover:border-blue-500">
            <div>
              <GraduationCap className="h-12 w-12 text-blue-400" aria-hidden="true" />
              <h2 className="mt-5 text-2xl font-black">{name}</h2>
              <p className="mt-2 text-sm text-slate-400">{BOOKS_BY_GRADE[grade].length} كتب</p>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-300">
              <BookOpen className="h-4 w-4" />عرض الكتب<ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
