import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Download, ArrowLeft } from 'lucide-react';
import { BOOKS_DATA } from '../data/booksData';

export default function BooksPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-gradient-to-l from-[#1D76BC] to-[#363B8E] text-white rounded-3xl p-8 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            <span>مكتبة المناهج الرسمية</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold">كتب الصفوف السابع، الثامن، والتاسع (9 كتب)</h1>
          <p className="mt-2 text-blue-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
            استعرض وحمل كتب الرياضيات، العلوم، والفيزياء والكيمياء المعتمدة لاختيار التجارب العلمية وتصميم محاكاة NetLogo الخاصة بفريقك.
          </p>
        </div>
        <Link
          to="/register"
          className="px-6 py-3 rounded-2xl bg-white text-[#1D76BC] hover:bg-blue-50 font-bold text-sm shadow-md transition shrink-0"
        >
          تسجيل فكرة مشروع الآن
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {BOOKS_DATA.map(book => (
          <div key={book.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex flex-col justify-between group">
            <div>
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-l ${book.coverColor} text-white flex items-center justify-center mb-5 shadow-md`}>
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-2">
                {book.grade}
              </span>
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-[#1D76BC] transition-colors">
                {book.subject}
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{book.description}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <Link
                to={`/grade/${book.gradeSlug}`}
                className="text-xs font-bold text-[#1D76BC] hover:underline flex items-center gap-1"
              >
                <span>مشاريع هذا الصف</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
              <a
                href={book.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-[#1D76BC] hover:text-white text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل الكتاب</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}