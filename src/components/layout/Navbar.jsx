import React from "react";
import { Link, NavLink } from "react-router-dom";
import { BookOpen, PlusCircle, Home } from "lucide-react";

export default function Navbar() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src={`${import.meta.env.BASE_URL}horizontal-logo.png`}
            alt="BlueBits Team"
            className="h-10 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <div className="hidden sm:block border-r border-slate-200 pr-3">
            <span className="block text-xs font-bold text-slate-400">
              مقرر النمذجة والمحاكاة
            </span>
            <span className="block text-sm font-extrabold text-[#1A1A1A]">
              منصة مشاريع NetLogo
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? "bg-[#1D76BC] text-white shadow-md shadow-[#1D76BC]/20"
                  : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <Home className="w-4 h-4" />
            <span className="hidden md:inline">الرئيسية</span>
          </NavLink>

          <NavLink
            to="/books"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? "bg-[#1D76BC] text-white shadow-md shadow-[#1D76BC]/20"
                  : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <BookOpen className="w-4 h-4" />
            <span>مكتبة الكتب (9)</span>
          </NavLink>

          <NavLink
            to="/register"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              }`
            }
          >
            <PlusCircle className="w-4 h-4" />
            <span>تسجيل مشروع</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
