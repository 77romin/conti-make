import { useRef } from 'react';
import { Download, Upload, Trash2, Info } from 'lucide-react';
import { exportBackup, importBackup } from '../utils/storage';

export default function Settings() {
  const fileInputRef = useRef();

  // 전체 데이터 백업 파일로 저장
  function handleExport() {
    const json = exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conti-make-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 백업 파일 불러와서 복원
  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        importBackup(ev.target.result);
        alert('복원이 완료되었습니다! 페이지를 새로고침하면 반영됩니다.');
        window.location.reload();
      } catch {
        alert('올바른 백업 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // 전체 데이터 초기화
  function handleReset() {
    if (!window.confirm('모든 악보와 콘티 데이터가 삭제됩니다. 계속할까요?')) return;
    localStorage.clear();
    alert('초기화되었습니다.');
    window.location.reload();
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">설정</h1>

      {/* 데이터 백업 */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-700">데이터 관리</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {/* 백업 */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 text-sm">데이터 백업</p>
              <p className="text-xs text-slate-400 mt-0.5">악보와 콘티를 JSON 파일로 저장합니다</p>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              <Download size={15} />
              백업 저장
            </button>
          </div>

          {/* 복원 */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 text-sm">데이터 복원</p>
              <p className="text-xs text-slate-400 mt-0.5">백업 파일로 데이터를 복원합니다</p>
            </div>
            <button
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Upload size={15} />
              파일 선택
            </button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>

          {/* 초기화 */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-red-600 text-sm">전체 초기화</p>
              <p className="text-xs text-slate-400 mt-0.5">모든 데이터를 삭제합니다 (복구 불가)</p>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <Trash2 size={15} />
              초기화
            </button>
          </div>
        </div>
      </section>

      {/* 앱 정보 */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-700">앱 정보</h2>
        </div>
        <div className="px-6 py-4 space-y-3 text-sm text-slate-600">
          <div className="flex justify-between">
            <span className="text-slate-400">버전</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">제작</span>
            <span className="font-medium">콘티메이크</span>
          </div>
          <div className="flex items-start gap-2 bg-indigo-50 rounded-lg px-3 py-2.5 mt-4">
            <Info size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-700">
              데이터는 이 브라우저의 로컬 저장소에 저장됩니다.
              중요한 데이터는 주기적으로 백업하세요.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
