import { useState, useEffect, useRef } from 'react';
import { Plus, Search, X, Upload, Globe } from 'lucide-react';
import { getScores, saveScore, deleteScore, updateScore } from '../utils/storage';
import ScoreCard from '../components/ScoreCard';
import ScoreSearch from '../components/ScoreSearch';

const CATEGORIES = ['찬양', '경배', '복음성가', '성가', '기타'];
const KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'];

export default function Library() {
  const [scores, setScores] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);  // 구글 검색 모달
  const [editTarget, setEditTarget] = useState(null);  // 수정 중인 악보
  const [form, setForm] = useState({ title: '', category: '', key: '', imageData: '' });
  const fileInputRef = useRef();

  useEffect(() => {
    setScores(getScores());
  }, []);

  // 검색 필터
  const filtered = scores.filter(s =>
    s.title.includes(search) || s.category.includes(search) || s.key.includes(search)
  );

  // 이미지 파일 선택 → base64 변환
  function handleImageFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, imageData: ev.target.result }));
    reader.readAsDataURL(file);
  }

  // 저장
  function handleSave() {
    if (!form.title.trim()) { alert('제목을 입력해주세요.'); return; }
    if (editTarget) {
      updateScore(editTarget.id, form);
    } else {
      saveScore(form);
    }
    setScores(getScores());
    closeModal();
  }

  function openAdd() {
    setEditTarget(null);
    setForm({ title: '', category: '', key: '', imageData: '' });
    setShowModal(true);
  }

  function openEdit(score) {
    setEditTarget(score);
    setForm({ title: score.title, category: score.category, key: score.key, imageData: score.imageData });
    setShowModal(true);
  }

  // 구글 검색에서 선택한 악보를 라이브러리에 저장
  function handleAddFromSearch(scoreData) {
    saveScore(scoreData);
    setScores(getScores());
  }

  function closeModal() {
    setShowModal(false);
    setEditTarget(null);
  }

  function handleDelete(id) {
    if (!window.confirm('이 악보를 삭제할까요?')) return;
    deleteScore(id);
    setScores(getScores());
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">악보 라이브러리</h1>
          <p className="text-slate-500 text-sm mt-1">전체 {scores.length}개의 악보</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 구글 이미지 검색으로 추가 */}
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 border border-indigo-200 text-indigo-600 bg-indigo-50 px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-100 transition-colors"
          >
            <Globe size={17} />
            구글로 검색
          </button>
          {/* 직접 업로드로 추가 */}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            직접 추가
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="악보 제목, 카테고리, 코드로 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={16} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* 악보 그리드 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-slate-400">악보가 없습니다. 악보를 추가해보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 group">
          {filtered.map(score => (
            <ScoreCard
              key={score.id}
              score={score}
              onDelete={handleDelete}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* 악보 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-lg text-slate-800">
                {editTarget ? '악보 수정' : '악보 추가'}
              </h2>
              <button onClick={closeModal}>
                <X size={20} className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 이미지 업로드 */}
              <div
                onClick={() => fileInputRef.current.click()}
                className="cursor-pointer border-2 border-dashed border-slate-200 rounded-xl overflow-hidden hover:border-indigo-300 transition-colors"
              >
                {form.imageData ? (
                  <img src={form.imageData} alt="미리보기" className="w-full max-h-48 object-contain" />
                ) : (
                  <div className="h-36 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Upload size={28} />
                    <span className="text-sm">악보 이미지를 클릭하여 업로드</span>
                    <span className="text-xs text-slate-300">JPG, PNG, PDF 지원</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFile}
              />

              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">제목 *</label>
                <input
                  type="text"
                  placeholder="예: 주님 다시 오실 때까지"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {/* 카테고리 + 코드 (나란히) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">카테고리</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    <option value="">선택 안 함</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">조(Key)</label>
                  <select
                    value={form.key}
                    onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    <option value="">선택 안 함</option>
                    {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 구글 이미지 검색 모달 */}
      {showSearch && (
        <ScoreSearch
          onAdd={handleAddFromSearch}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
