import { BookOpen, Home, PlusCircle } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

const itemClass = ({ isActive }) =>
  `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
    isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#070c16]/95 backdrop-blur">
      <div className="shell flex min-h-20 min-w-0 items-center justify-between gap-3 py-3">
        <Link to="/" className="min-w-0 shrink">
          <img src={`${import.meta.env.BASE_URL}horizontal-logo.png`} alt="فريق BlueBits" className="h-9 w-auto max-w-[135px] object-contain sm:h-11 sm:max-w-none" />
        </Link>
        <nav aria-label="التنقل الرئيسي" className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 sm:gap-2">
          <NavLink to="/" end className={itemClass}><Home className="h-4 w-4" /><span className="hidden md:inline">الرئيسية</span></NavLink>
          <NavLink to="/books" className={itemClass}><BookOpen className="h-4 w-4" /><span className="hidden sm:inline">الكتب</span></NavLink>
          <NavLink to="/register" className={itemClass}><PlusCircle className="h-4 w-4" /><span>تسجيل</span></NavLink>
        </nav>
      </div>
    </header>
  );
}
