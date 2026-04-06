import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Calendar, Music, ChevronRight } from 'lucide-react';
import { getContis, deleteConti } from '../utils/storage';

// 예배 종류별 색상
const WORSHIP_COLORS = {
  '주일예배':  'bg-indigo-100 text-indigo-700',
  '수요예배':  'bg-emerald-100 text-emerald-700',
  '금요기도회': 'bg-amber-100 text-amber-700',
  '새벽예배':  'bg-sky-100 text-sky-700',
  '기타':      'bg-slate-100 text-slate-700',
};

export default function Home() {
  const [contis, setContis] = useState([]);

  useEffect(() => {
    setContis(getContis());
  }, []);

  function handleDelete(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('이 콘티를 삭제할까요?')) return;
    deleteConti(id);
    setContis(getContis());
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">내 콘티 목록</h1>
          <p className="text-slate-500 text-sm mt-1">찬양 악보를 정리하고 출력하세요</p>
        </div>
        <Link
          to="/editor/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          새 콘티 만들기
        </Link>
      </div>

      {/* 콘티 목록 */}
      {contis.length === 0 ? (
        // 빈 상태 안내
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Music size={36} className="text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">아직 콘티가 없어요</h2>
          <p className="text-slate-400 text-sm mb-6">
            새 콘티 만들기 버튼으로 첫 번째 콘티를 만들어보세요!
          </p>
          <Link
            to="/editor/new"
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            첫 콘티 만들기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {contis.map(conti => (
            <Link
              key={conti.id}
              to={`/editor/${conti.id}`}
              className="group flex items-center justify-between bg-white rounded-xl px-5 py-4 shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                {/* 아이콘 */}
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Music size={20} className="text-indigo-500" />
                </div>

                {/* 콘티 정보 */}
                <div>
                  <p className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                    {conti.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar size={12} />
                      {conti.date}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${WORSHIP_COLORS[conti.worshipType] || WORSHIP_COLORS['기타']}`}>
                      {conti.worshipType}
                    </span>
                    <span className="text-xs text-slate-400">
                      {conti.paperSize} · {conti.scoreIds.length}곡
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 삭제 버튼 */}
                <button
                  onClick={e => handleDelete(conti.id, e)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
                <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
