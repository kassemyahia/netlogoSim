import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-[#1A1A1A] text-white border-t border-slate-800 mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-[#1D76BC]">BLUEBITS TEAM 2026</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">جميع الحقوق محفوظة</span>
        </div>
        <div className="text-slate-400 font-medium">
          فريق بلوبيتس 2026 • النمذجة والمحاكاة
        </div>
      </div>
    </footer>
  );
}