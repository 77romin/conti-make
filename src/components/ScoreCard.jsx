import { Trash2, Edit2 } from 'lucide-react';

/**
 * 악보 라이브러리에서 개별 악보를 표시하는 카드 컴포넌트
 */
export default function ScoreCard({ score, onDelete, onEdit, onClick, selected }) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-xl overflow-hidden shadow-sm border-2 transition-all cursor-pointer
        ${selected
          ? 'border-indigo-500 shadow-md'
          : 'border-transparent hover:border-slate-200 hover:shadow-md'
        }`}
    >
      {/* 악보 이미지 */}
      <div className="aspect-[3/4] bg-slate-100 overflow-hidden">
        {(score.imageData || score.imageUrl) ? (
          <img
            src={score.imageData || score.imageUrl}
            alt={score.title}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
            이미지 없음
          </div>
        )}
      </div>

      {/* 악보 정보 */}
      <div className="p-3">
        <p className="font-semibold text-sm text-slate-800 truncate">{score.title}</p>
        <div className="flex items-center gap-2 mt-1">
          {score.key && (
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
              {score.key}
            </span>
          )}
          {score.category && (
            <span className="text-xs text-slate-400">{score.category}</span>
          )}
        </div>
      </div>

      {/* 선택 표시 */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* 액션 버튼 (호버 시 표시) */}
      {(onEdit || onDelete) && (
        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(score); }}
              className="w-7 h-7 bg-white rounded-full shadow flex items-center justify-center hover:bg-slate-50"
            >
              <Edit2 size={13} className="text-slate-600" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(score.id); }}
              className="w-7 h-7 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50"
            >
              <Trash2 size={13} className="text-red-500" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
