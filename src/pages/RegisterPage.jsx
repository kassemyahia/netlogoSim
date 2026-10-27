import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "../services/supabase";

const GRADES = ["الصف السابع", "الصف الثامن", "الصف التاسع"];
const SUBJECTS = ["الرياضيات", "العلوم", "الفيزياء والكيمياء"];

export default function RegisterPage() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([
    { name: "", collegeId: "" },
    { name: "", collegeId: "" },
    { name: "", collegeId: "" },
    { name: "", collegeId: "" },
  ]);

  const [grade, setGrade] = useState("الصف السابع");
  const [subject, setSubject] = useState("الرياضيات");
  const [unit, setUnit] = useState("");
  const [page, setPage] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [file, setFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successResult, setSuccessResult] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleMemberChange = (index, field, value) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const addMemberSlot = () => {
    if (members.length < 8) {
      setMembers([...members, { name: "", collegeId: "" }]);
    }
  };

  const removeMemberSlot = (index) => {
    if (members.length > 4) {
      const updated = members.filter((_, i) => i !== index);
      setMembers(updated);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const validMembers = members.filter(
      (m) => m.name.trim() && m.collegeId.trim(),
    );
    if (validMembers.length < 4 || validMembers.length > 8) {
      setErrorMessage(
        "يجب إدخال معلومات صحيحة لعدد أعضاء يتراوح بين 4 و 8 أعضاء.",
      );
      return;
    }

    setSubmitting(true);

    try {
      let fileUrl = "";
      let fileName = "";

      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileNameClean = `reg_${Date.now()}.${fileExt}`;
        const filePath = `uploads/${fileNameClean}`;

        const { error: storageError } = await supabase.storage
          .from("project-files")
          .upload(filePath, file);

        if (storageError) throw storageError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("project-files").getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = file.name;
      }
      // Correct RPC call in RegisterPage.jsx:
      const { data, error: rpcError } = await supabase.rpc("register_project", {
        p_team_members_json: validMembers, // Pass the JS array directly! Supabase handles JSON conversion automatically.
        p_grade: grade,
        p_subject: subject,
        p_unit: unit,
        p_page: parseInt(page),
        p_idea_description: ideaDescription,
        p_file_url: fileUrl,
        p_file_name: fileName,
      });

      if (rpcError) throw rpcError;

      if (data.status === "success") {
        setSuccessResult({
          teamCode: data.team_code,
          grade,
          subject,
          page,
        });
      } else {
        setErrorMessage(
          data.message ||
            "حدث خطأ أثناء التسجيل. قد تكون الصفحة محجوزة مسبقاً.",
        );
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "تعذر الاتصال بقاعدة البيانات. تأكد من أن هذه الصفحة لم تُحجز من قبل فريق آخر.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (successResult?.teamCode) {
      navigator.clipboard.writeText(successResult.teamCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (successResult) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            تم تسجيل فكرة المشروع بنجاح!
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            تم حفظ تفاصيل فريقك وتجربتك في كتاب{" "}
            <strong className="text-slate-900">
              {successResult.subject} ({successResult.grade}) - صفحة{" "}
              {successResult.page}
            </strong>
            .
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 max-w-md mx-auto">
            <span className="block text-xs font-bold text-slate-500 mb-1">
              كود الفريق السري (احفظه جيداً لرفع أو تعديل ملفك لاحقاً):
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-2xl font-extrabold text-[#1D76BC] tracking-wider">
                {successResult.teamCode}
              </span>
              <button
                onClick={copyCodeToClipboard}
                className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 transition"
                title="نسخ الكود"
              >
                {copiedCode ? (
                  <Check className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Copy className="w-5 h-5 text-slate-600" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={() =>
                navigate(
                  `/grade/${successResult.grade === "الصف السابع" ? "7" : successResult.grade === "الصف الثامن" ? "8" : "9"}`,
                )
              }
              className="px-6 py-3 rounded-xl bg-[#1D76BC] hover:bg-[#363B8E] text-white font-bold text-sm shadow-md transition"
            >
              عرض جدول المشاريع
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
        <div className="border-b border-slate-100 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1D76BC]/10 text-[#1D76BC] text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>تسجيل فكرة وحجز تجربة</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            تسجيل فريق النمذجة والمحاكاة
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            يرجى إدخال أسماء أعضاء الفريق (من 4 إلى 8 أعضاء) مع الأرقام الجامعية
            ومصدر التجربة من المناهج المدرسية.
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm font-bold flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-bold text-slate-900">
                  أعضاء الفريق (من 4 إلى 8 أعضاء) *
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  أدخل الاسم الكامل والرقم الجامعي لكل عضو.
                </p>
              </div>
              {members.length < 8 && (
                <button
                  type="button"
                  onClick={addMemberSlot}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1D76BC]/10 hover:bg-[#1D76BC]/20 text-[#1D76BC] text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>إضافة عضو (+)</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {members.map((member, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200"
                >
                  <span className="w-6 text-xs font-bold text-slate-400 text-center">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    value={member.name}
                    onChange={(e) =>
                      handleMemberChange(idx, "name", e.target.value)
                    }
                    placeholder="الاسم الكامل"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D76BC]"
                  />
                  <input
                    type="text"
                    required
                    value={member.collegeId}
                    onChange={(e) =>
                      handleMemberChange(idx, "collegeId", e.target.value)
                    }
                    placeholder="الرقم الجامعي"
                    className="w-32 sm:w-44 rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#1D76BC]"
                  />
                  {members.length > 4 && (
                    <button
                      type="button"
                      onClick={() => removeMemberSlot(idx)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="حذف العضو"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                الصف الدراسي *
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D76BC]"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                كتاب المادة *
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D76BC]"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                الوحدة الدراسية *
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="مثال: الوحدة الخامسة"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D76BC]"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                رقم الصفحة في الكتاب *
              </label>
              <input
                type="number"
                required
                min="1"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                placeholder="مثال: 200"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D76BC]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              شرح فكرة التجربة / المحاكاة *
            </label>
            <textarea
              required
              rows={3}
              value={ideaDescription}
              onChange={(e) => setIdeaDescription(e.target.value)}
              placeholder="اكتب وصفاً مختصراً للتجربة وكيف ستتم محاكاتها باستخدام NetLogo..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D76BC]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              ملف المشروع (.html أو .nlogo) - اختياري الآن
            </label>
            <input
              type="file"
              accept=".html,.nlogo"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#1D76BC]/10 file:text-[#1D76BC] hover:file:bg-[#1D76BC]/20 cursor-pointer"
            />
            <p className="text-xs text-slate-400 mt-1">
              يمكنك رفع الملف الآن أو تركه لحين إكماله ورفعه لاحقاً باستخدام كود
              الفريق.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3.5 rounded-2xl bg-[#1D76BC] hover:bg-[#363B8E] text-white font-bold text-sm shadow-lg shadow-[#1D76BC]/20 flex items-center gap-2 disabled:bg-slate-300 transition"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحجز والتسجيل...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد وتسجيل المشروع</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
