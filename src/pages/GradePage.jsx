import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PlusCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import ProjectsTable from '../components/ui/ProjectsTable';

export default function GradePage() {
  const { gradeSlug } = useParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const gradeName = gradeSlug === '7' ? 'الصف السابع' : gradeSlug === '8' ? 'الصف الثامن' : 'الصف التاسع';

  const fetchGradeProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('public_projects')
      .select('*')
      .eq('grade', gradeName)
      .order('page', { ascending: true });

    if (!error && data) {
      setProjects(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGradeProjects();
  }, [gradeSlug]);

  const filteredProjects = activeTab === 'all' 
    ? projects 
    : projects.filter(p => p.subject === activeTab);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
            <Link to="/" className="hover:text-[#1D76BC]">الرئيسية</Link>
            <span>/</span>
            <span className="text-[#1D76BC]">{gradeName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{gradeName} - مشاريع النمذجة والمحاكاة</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/register"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>تسجيل مشروع جديد</span>
          </Link>
          <button
            onClick={fetchGradeProjects}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1D76BC]' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        {[
          { id: 'all', label: 'جميع الكتب' },
          { id: 'الرياضيات', label: 'كتاب الرياضيات' },
          { id: 'العلوم', label: 'كتاب العلوم' },
          { id: 'الفيزياء والكيمياء', label: 'كتاب الفيزياء والكيمياء' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-[#1D76BC] text-white shadow-md shadow-[#1D76BC]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <RefreshCw className="w-8 h-8 text-[#1D76BC] animate-spin mx-auto mb-3" />
          <p className="text-slate-600 font-medium">جاري تحميل مشاريع {gradeName}...</p>
        </div>
      ) : (
        <ProjectsTable projects={filteredProjects} onProjectUpdated={fetchGradeProjects} />
      )}
    </div>
  );
}