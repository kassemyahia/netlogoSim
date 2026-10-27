import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PlusCircle, Users, Sparkles, GraduationCap, ArrowLeft } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function HomePage() {
  const [projectsCount, setProjectsCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase.from('public_projects').select('*', { count: 'exact', head: true });
      if (count !== null) setProjectsCount(count);
    }
    fetchCount();
  }, []);

  const grades = [
    { title: "الصف السابع", slug: "7", subtitle: "الرياضيات، العلوم، الفيزياء والكيمياء", color: "from-blue-600 to-indigo-700" },
    { title: "الصف الثامن", slug: "8", subtitle: "الرياضيات، العلوم، الفيزياء والكيمياء", color: "from-emerald-600 to-teal-700" },
    { title: "الصف التاسع", slug: "9", subtitle: "الرياضيات، العلوم، الفيزياء والكيمياء", color: "from-purple-600 to-indigo-800" }
  ];

  return (
    <div className="space-y-12 pb-16">
      <section className="relative overflow-hidden bg-gradient-to-l from-[#1D76BC] via-[#363B8E] to-[#1A1A1A] text-white py-16 px-4 sm:px-6 lg:px-8 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="max-w-2xl text-center md:text-right">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold mb-4 backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span>مقرر النمذجة والمحاكاة • فريق بلوبيتس 2026</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              منصة تنظيم مشاريع NetLogo للمناهج الدراسية
            </h1>
            <p className="mt-4 text-blue-100 text-sm sm:text-base leading-relaxed">
              اختر تجربتك من كتب الصف السابع، الثامن، أو التاسع (رياضيات، علوم، فيزياء والكيمياء)، سجل فريقك، وابدأ محاكاتها بسهولة.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-4">
              <Link
                to="/register"
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition"
              >
                <PlusCircle className="w-5 h-5" />
                <span>تسجيل فكرة مشروع جديد</span>
              </Link>
              <Link
                to="/books"
                className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold text-sm backdrop-blur-md flex items-center gap-2 transition"
              >
                <BookOpen className="w-5 h-5" />
                <span>استعراض مكتبة الكتب (9)</span>
              </Link>
            </div>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 backdrop-blur-md text-center shadow-2xl min-w-[240px]">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3 text-white">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-3xl font-extrabold">{projectsCount}</div>
            <div className="text-xs text-blue-200 mt-1">مشروع وتجربة مسجلة حتى الآن</div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-10">
          <h2 className="text-2xl font-extrabold text-[#1A1A1A]">اختر الصف الدراسي لاستعراض المشاريع</h2>
          <p className="text-sm text-slate-500 mt-2">يمكنك تصفح التجارب المحجوزة لكل صف دراسي على حدة للتأكد من عدم تكرار الأفكار.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {grades.map(grade => (
            <Link
              key={grade.slug}
              to={`/grade/${grade.slug}`}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 p-8 flex flex-col justify-between group overflow-hidden relative"
            >
              <div className={`absolute top-0 right-0 left-0 h-2 bg-gradient-to-l ${grade.color}`} />
              <div>
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-l ${grade.color} text-white flex items-center justify-center mb-6 shadow-md group-hover:scale-110 transition-transform`}>
                  <GraduationCap className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900 group-hover:text-[#1D76BC] transition-colors">
                  {grade.title}
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{grade.subtitle}</p>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#1D76BC]">
                <span>تصفح الكتب والمشاريع</span>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}