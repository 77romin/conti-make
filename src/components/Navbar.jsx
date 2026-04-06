import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Music, BookOpen, Settings, Plus, Sparkles } from 'lucide-react';
import AiContiGenerator from './AiContiGenerator';

const navItems = [
  { path: '/',         icon: Music,    label: '홈' },
  { path: '/library',  icon: BookOpen, label: '악보' },
  { path: '/settings', icon: Settings, label: '설정' },
];

export default function Navbar() {
  const location = useLocation();
  const [showAI, setShowAI] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* 로고 */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-indigo-600">
            <Music size={22} />
            콘티메이크
          </Link>

          {/* 네비게이션 */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path;
              return (
                <Link key={path} to={path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {/* AI 콘티 생성 버튼 */}
            <button
              onClick={() => setShowAI(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm"
            >
              <Sparkles size={15} />
              AI 콘티
            </button>

            {/* 새 콘티 수동 생성 */}
            <Link to="/editor/new"
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              <Plus size={16} />
              새 콘티
            </Link>
          </div>
        </div>
      </header>

      {/* AI 콘티 생성 모달 */}
      {showAI && <AiContiGenerator onClose={() => setShowAI(false)} />}
    </>
  );
}
