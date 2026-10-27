import React, { useState, useMemo } from 'react';
import { 
  Search, ArrowUpDown, Download, Upload, CheckCircle2, 
  AlertTriangle, RefreshCw, Lock, Play, X 
} from 'lucide-react';
import { supabase } from '../../services/supabase';

export default function ProjectsTable({ projects, onProjectUpdated }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('page');
  const [sortDirection, setSortDirection] = useState('asc');

  const [activeProject, setActiveProject] = useState(null);
  const [teamCodeInput, setTeamCodeInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [previewHtmlUrl, setPreviewHtmlUrl] = useState(null);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedProjects = useMemo(() => {
    let result = projects.filter(p => {
      const query = searchQuery.toLowerCase();
      const membersString = Array.isArray(p.team_members_json) 
        ? p.team_members_json.map(m => `${m.name} ${m.collegeId}`).join(' ').toLowerCase()
        : '';
      
      return (
        membersString.includes(query) ||
        String(p.grade || '').toLowerCase().includes(query) ||
        String(p.subject || '').toLowerCase().includes(query) ||
        String(p.unit || '').toLowerCase().includes(query) ||
        String(p.page || '').toLowerCase().includes(query) ||
        String(p.idea_description || '').toLowerCase().includes(query)
      );
    });

    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'page') {
        valA = Number(valA);
        valB = Number(valB);
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [projects, searchQuery, sortField, sortDirection]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!teamCodeInput.trim() || !selectedFile || !activeProject) {
      setUploadError('يرجى إدخال كود الفريق واختيار ملف المشروع.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileNameClean = `${activeProject.id}_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileNameClean}`;

      const { error: storageError } = await supabase.storage
        .from('project-files')
        .upload(filePath, selectedFile, { upsert: true });

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(filePath);

      const { data, error: rpcError } = await supabase.rpc('upload_team_project_file', {
        p_project_id: activeProject.id,
        p_code: teamCodeInput.trim(),
        p_file_url: publicUrl,
        p_file_name: selectedFile.name
      });

      if (rpcError) throw rpcError;

      if (data.status === 'success') {
        setUploadSuccess('تم رفع ملف المشروع وتحديثه بنجاح!');
        setTimeout(() => {
          setActiveProject(null);
          setTeamCodeInput('');
          setSelectedFile(null);
          setUploadSuccess('');
          if (onProjectUpdated) onProjectUpdated();
        }, 1500);
      } else {
        setUploadError(data.message || 'كود الفريق غير صحيح.');
      }
    } catch (err) {
      console.error(err);
      setUploadError('حدث خطأ أثناء رفع الملف.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الطالب، الرقم الجامعي، الوحدة، أو الصفحة..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D76BC]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 w-full sm:w-auto justify-end">
          <span>ترتيب حسب:</span>
          <button
            onClick={() => handleSort('page')}
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 ${sortField === 'page' ? 'bg-[#1D76BC]/10 border-[#1D76BC] text-[#1D76BC]' : 'border-slate-200'}`}
          >
            <span>الصفحة</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleSort('subject')}
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 ${sortField === 'subject' ? 'bg-[#1D76BC]/10 border-[#1D76BC] text-[#1D76BC]' : 'border-slate-200'}`}
          >
            <span>الكتاب</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase">
                <th className="py-4 px-4">#</th>
                <th className="py-4 px-4">أعضاء الفريق (الأسماء والأرقام الجامعية)</th>
                <th className="py-4 px-4">الصف والكتاب</th>
                <th className="py-4 px-4">الوحدة والصفحة</th>
                <th className="py-4 px-4">شرح الفكرة / التجربة</th>
                <th className="py-4 px-4 text-center">ملف المشروع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredAndSortedProjects.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 font-medium">
                    لا توجد مشاريع مسجلة مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filteredAndSortedProjects.map((project, idx) => (
                  <tr key={project.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-400">{idx + 1}</td>
                    
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        {Array.isArray(project.team_members_json) && project.team_members_json.map((member, mIdx) => (
                          <div key={mIdx} className="text-xs flex items-center gap-2">
                            <span className="font-bold text-slate-900">{member.name}</span>
                            <span className="text-slate-400 font-mono">({member.collegeId})</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{project.subject}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{project.grade}</div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="text-slate-800 font-medium">{project.unit}</div>
                      <div className="text-xs font-bold text-[#1D76BC] mt-0.5">الصفحة {project.page}</div>
                    </td>

                    <td className="py-4 px-4 max-w-xs">
                      <p className="text-slate-700 text-xs leading-relaxed">{project.idea_description}</p>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        {project.is_submitted ? (
                          <div className="flex items-center gap-2">
                            {project.file_url && project.file_url.endsWith('.html') && (
                              <button
                                onClick={() => setPreviewHtmlUrl(project.file_url)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 transition"
                                title="معاينة التشغيل"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>معاينة</span>
                              </button>
                            )}
                            <a
                              href={project.file_url}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-[#1D76BC]/10 text-[#1D76BC] border border-[#1D76BC]/20 text-xs font-bold flex items-center gap-1 hover:bg-[#1D76BC]/20 transition"
                              title="تحميل الملف"
                            >
                              <Download className="w-3 h-3" />
                              <span>تحميل</span>
                            </a>
                          </div>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                            بانتظار رفع الملف
                          </span>
                        )}

                        <button
                          onClick={() => {
                            setActiveProject(project);
                            setTeamCodeInput('');
                            setSelectedFile(null);
                            setUploadError('');
                            setUploadSuccess('');
                          }}
                          className="text-xs text-slate-500 hover:text-[#1D76BC] underline font-semibold flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          <span>رفع / تحديث الملف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#1D76BC]" />
                <span>رفع ملف مشروع NetLogo</span>
              </h3>
              <button onClick={() => setActiveProject(null)} className="p-1 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              التجربة: <strong className="text-slate-800">{activeProject.subject} ({activeProject.grade}) - ص {activeProject.page}</strong>
              <br />
              أدخل <strong>كود الفريق السري</strong> لرفع أو تحديث ملف المشروع.
            </p>

            {uploadError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">كود الفريق السري *</label>
                <input
                  type="text"
                  required
                  value={teamCodeInput}
                  onChange={(e) => setTeamCodeInput(e.target.value)}
                  placeholder="مثال: NL-8F4K9"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#1D76BC]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملف المشروع (.html أو .nlogo) *</label>
                <input
                  type="file"
                  required
                  accept=".html,.nlogo"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#1D76BC]/10 file:text-[#1D76BC] hover:file:bg-[#1D76BC]/20 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveProject(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-[#1D76BC] hover:bg-[#363B8E] text-white text-xs font-bold shadow-md shadow-[#1D76BC]/20 flex items-center gap-2 disabled:bg-slate-300"
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>رفع الملف</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewHtmlUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#1A1A1A] text-white flex items-center justify-between">
              <span className="font-bold text-sm">معاينة محاكاة NetLogo Web</span>
              <button onClick={() => setPreviewHtmlUrl(null)} className="p-1 rounded-lg hover:bg-rose-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100">
              <iframe src={previewHtmlUrl} title="Simulation Preview" className="w-full h-full border-0" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}