import { ArrowLeft, BookOpen, Download, Eye, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BOOKS } from '../config/books';

export default function BooksPage() {
  return (
    <main className="shell space-y-8 py-8 sm:py-12">
      <section className="panel bg-gradient-to-l from-blue-950 to-slate-950 sm:p-8">
        <p className="mb-2 text-sm font-bold text-blue-300">مكتبة المناهج الرسمية</p>
        <h1 className="text-2xl font-black sm:text-4xl">تسعة كتب لاختيار فكرة التجربة</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">الكتب متاحة للقراءة فقط عبر Google Drive. قد يفتح زر التنزيل صفحة Drive إذا تعذر التنزيل المباشر.</p>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {BOOKS.map((book) => (
          <article key={book.id} className="panel flex min-w-0 flex-col">
            <BookOpen className="mb-4 h-10 w-10 text-blue-400" aria-hidden="true" />
            <p className="text-xs font-bold text-blue-300">{book.grade}</p>
            <h2 className="mt-1 text-xl font-bold">{book.subject}</h2>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
              {book.fileId ? (
                <>
                  <a className="btn-primary flex-1" href={book.viewUrl} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" />عرض الكتاب</a>
                  <a className="btn-secondary flex-1" href={book.openUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" />فتح / تنزيل</a>
                </>
              ) : (
                <div className="flex w-full items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  <ShieldAlert className="h-4 w-4 shrink-0" />الكتاب غير متاح حالياً
                </div>
              )}
              <Link to={`/grade/${book.gradeSlug}`} className="mt-2 inline-flex w-full items-center gap-1 text-sm font-bold text-blue-300 hover:text-blue-200">مشاريع الصف <ArrowLeft className="h-4 w-4" /></Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
