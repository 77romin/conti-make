import { useState, useRef, useCallback } from 'react';
import { Search, X, Download, AlertCircle, CheckCircle, Loader, ExternalLink, ServerCrash } from 'lucide-react';
import { searchImages, downloadImageAsBase64 } from '../utils/imageSearch';

const QUICK_SEARCHES = ['주님 다시 오실 때까지', '완전하신 나의 주', '예배합니다', '주 이름 찬양', '나의 힘이 되신 여호와'];

export default function ScoreSearch({ onAdd, onClose }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(false);

  // 이미지별 저장 상태: { [url]: 'idle'|'loading'|'done'|'error' }
  const [saveState, setSaveState] = useState({});

  const inputRef = useRef();

  // ─── 검색 ──────────────────────────────────────────────────
  const doSearch = useCallback(async (q, pageNum = 1) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    if (pageNum === 1) setResults([]);

    try {
      const data = await searchImages(trimmed, pageNum);

      setResults(prev => pageNum === 1 ? data.items : [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (e) {
      if (e.message === 'SERVER_NOT_RUNNING') {
        setError('SERVER_NOT_RUNNING');
      } else {
        setError(e.message || '검색 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    doSearch(query, 1);
  }

  function handleQuickSearch(q) {
    setQuery(q);
    doSearch(q, 1);
  }

  // ─── 악보 저장 ──────────────────────────────────────────────
  async function handleSave(item) {
    const key = item.imageUrl;
    setSaveState(s => ({ ...s, [key]: 'loading' }));

    // base64 이미지는 그대로 저장
    if (item.isBase64 || item.imageUrl.startsWith('data:')) {
      onAdd({ title: item.title || query, imageData: item.imageUrl });
      setSaveState(s => ({ ...s, [key]: 'done' }));
      return;
    }

    // 백엔드 프록시로 다운로드 (CORS 없음 → 팝업 없음)
    const base64 = await downloadImageAsBase64(item.imageUrl);

    if (base64) {
      onAdd({ title: item.title || query, imageData: base64, sourceUrl: item.imageUrl });
    } else {
      // 백엔드도 실패한 경우 URL로 저장 (팝업 없이 조용히 처리)
      onAdd({ title: item.title || query, imageData: null, imageUrl: item.imageUrl });
    }
    setSaveState(s => ({ ...s, [key]: 'done' }));
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0">
          <Search size={20} className="text-indigo-500" />
          <h2 className="font-bold text-lg text-slate-800 flex-1">구글 이미지로 악보 검색</h2>
          <button onClick={onClose}>
            <X size={20} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* 서버 미실행 안내 */}
        {error === 'SERVER_NOT_RUNNING' ? (
          <ServerGuide />
        ) : (
          <>
            {/* 검색창 */}
            <div className="px-6 pt-4 pb-3 flex-shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="찬양 제목 입력 (예: 주님 다시 오실 때까지)"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  검색
                </button>
              </form>

              {/* 빠른 검색 태그 */}
              <div className="flex gap-2 mt-2.5 flex-wrap">
                {QUICK_SEARCHES.map(q => (
                  <button
                    key={q}
                    onClick={() => handleQuickSearch(q)}
                    className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* 일반 오류 */}
              {error && error !== 'SERVER_NOT_RUNNING' && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>

            {/* 결과 영역 */}
            <div className="overflow-y-auto flex-1 px-6 pb-4">
              {loading && results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <Loader size={28} className="animate-spin" />
                  <span className="text-sm">구글에서 악보를 검색하는 중…</span>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm">
                  <Search size={32} className="mb-3 opacity-30" />
                  찬양 제목을 입력하고 검색하세요
                </div>
              ) : (
                <>
                  {/* 이미지 그리드 */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {results.map((item, idx) => {
                      const key   = item.imageUrl;
                      const state = saveState[key] || 'idle';
                      const thumb = item.thumbnail || item.imageUrl;

                      return (
                        <div
                          key={`${key}-${idx}`}
                          className="group relative bg-slate-50 rounded-xl overflow-hidden border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all"
                        >
                          {/* 썸네일 */}
                          <div className="aspect-[3/4] overflow-hidden bg-slate-100">
                            <img
                              src={thumb}
                              alt={item.title || '악보'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                              onError={e => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML =
                                  '<div class="w-full h-full flex items-center justify-center text-xs text-slate-300">미리보기 없음</div>';
                              }}
                            />
                          </div>

                          {/* 저장 버튼 오버레이 (호버 시) */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 items-center px-2">
                              {state === 'done' ? (
                                <div className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
                                  <CheckCircle size={13} />
                                  저장됨
                                </div>
                              ) : state === 'loading' ? (
                                <div className="flex items-center gap-1.5 bg-white text-slate-700 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
                                  <Loader size={13} className="animate-spin" />
                                  다운로드 중…
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleSave(item)}
                                  className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-indigo-700 shadow-lg"
                                >
                                  <Download size={13} />
                                  악보에 추가
                                </button>
                              )}

                              {/* 원본 페이지 링크 */}
                              {item.imageUrl && !item.isBase64 && (
                                <a
                                  href={item.imageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="flex items-center gap-1 bg-white/80 text-slate-600 px-2.5 py-1 rounded-full text-xs hover:bg-white shadow"
                                >
                                  <ExternalLink size={11} />
                                  원본 보기
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* 로딩 중 스켈레톤 */}
                    {loading && results.length > 0 &&
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={`skel-${i}`} className="aspect-[3/4] bg-slate-100 rounded-xl animate-pulse" />
                      ))
                    }
                  </div>

                  {/* 더 보기 */}
                  {hasMore && !loading && (
                    <div className="flex justify-center mt-5">
                      <button
                        onClick={() => doSearch(query, page + 1)}
                        className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
                      >
                        더 보기
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 서버 미실행 안내 ──────────────────────────────────────────
function ServerGuide() {
  return (
    <div className="px-8 py-8 flex flex-col items-center text-center gap-4">
      <ServerCrash size={40} className="text-amber-400" />
      <h3 className="font-bold text-slate-800 text-lg">백엔드 서버를 먼저 실행해주세요</h3>
      <p className="text-slate-500 text-sm leading-relaxed">
        구글 이미지 검색을 사용하려면 프록시 서버가 필요합니다.<br />
        터미널을 새 탭으로 열고 아래 명령어를 실행하세요.
      </p>

      <div className="bg-slate-800 text-green-400 rounded-xl px-6 py-4 text-sm font-mono text-left w-full max-w-sm">
        <p className="text-slate-500 text-xs mb-2"># 새 터미널에서 실행</p>
        <p>cd conti-make/backend</p>
        <p>node server.js</p>
      </div>

      <p className="text-xs text-slate-400">
        서버를 실행한 뒤 다시 검색해보세요.
      </p>
    </div>
  );
}
