import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Sparkles, Loader, AlertCircle, CheckCircle, XCircle,
  ChevronRight, Music, BookOpen, KeyRound, Send, Search,
  SkipForward, Download, ExternalLink,
} from 'lucide-react';
import { generateConti } from '../utils/gemini';
import { getScores, saveScore, saveConti } from '../utils/storage';
import { searchImages, downloadImageAsBase64 } from '../utils/imageSearch';

const QUICK_TEMPLATES = [
  '주일 오전 예배 콘티 짜줘\n- 예배를 여는 찬양 (10분)\n- 기도\n- 말씀\n- 응답 찬양 (5분)\n- 파송찬양 1곡',
  '수요 기도회 콘티 짜줘\n- 찬양 (15분)\n- 기도회\n- 마무리 찬양 1곡',
  '새벽예배 콘티 짜줘\n- 찬양 2~3곡\n- 기도\n- 말씀\n- 마무리 찬양',
];

export default function AiContiGenerator({ onClose }) {
  const navigate = useNavigate();
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  // add-missing 단계 상태
  const [step, setStep]               = useState('main'); // 'main' | 'add-missing'
  const [missingQueue, setMissingQueue] = useState([]);
  const [missingIndex, setMissingIndex] = useState(0);
  const [baseScoreIds, setBaseScoreIds] = useState([]);
  const [addedScoreIds, setAddedScoreIds] = useState([]);

  // 검색 상태 (add-missing 단계용)
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError]     = useState('');
  const [saveState, setSaveState]         = useState({});

  const library = getScores();

  // ─── AI 콘티 생성 요청 ────────────────────────────────────
  async function handleGenerate() {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await generateConti(input);
      data.sections = data.sections.map(section => ({
        ...section,
        songs: section.songs.map(song => ({
          ...song,
          matchedScore: findMatch(song.title),
        })),
      }));
      setResult(data);
    } catch (e) {
      if (e.message === 'API_KEY_NOT_SET')     setError('API_KEY_NOT_SET');
      else if (e.message === 'API_KEY_INVALID') setError('API_KEY_INVALID');
      else if (e.message === 'QUOTA_EXCEEDED')  setError('오늘 Gemini 무료 할당량(1M 토큰)을 초과했습니다. 내일 다시 시도해주세요.');
      else setError(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function findMatch(title) {
    if (!title) return null;
    const norm = t => t?.toLowerCase().replace(/[\s\(\)\[\]]/g, '') || '';
    return library.find(s =>
      norm(s.title).includes(norm(title)) || norm(title).includes(norm(s.title))
    ) || null;
  }

  // ─── "콘티 만들기" 클릭 → missing 곡 있으면 검색 단계로 ──────
  function handleProceed() {
    if (!result) return;

    const baseIds = [];
    const missing = [];

    result.sections.forEach(section => {
      if (!section.hasSongs) return;
      section.songs.forEach(song => {
        if (song.matchedScore) {
          if (!baseIds.includes(song.matchedScore.id)) baseIds.push(song.matchedScore.id);
        } else {
          missing.push(song);
        }
      });
    });

    setBaseScoreIds(baseIds);
    setAddedScoreIds([]);

    if (missing.length === 0) {
      doCreateConti(baseIds, [], result);
    } else {
      setMissingQueue(missing);
      setMissingIndex(0);
      setSearchResults([]);
      setSaveState({});
      setStep('add-missing');
    }
  }

  // add-missing 단계: 곡이 바뀌면 자동 검색
  const doSearch = useCallback(async (title) => {
    setSearchLoading(true);
    setSearchError('');
    setSearchResults([]);
    setSaveState({});
    try {
      const data = await searchImages(title + ' 악보', 1);
      setSearchResults(data.items);
    } catch (e) {
      setSearchError(e.message === 'SERVER_NOT_RUNNING'
        ? '백엔드 서버를 먼저 실행해주세요 (cd backend && node server.js)'
        : (e.message || '검색 오류'));
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 'add-missing' && missingQueue.length > 0 && missingIndex < missingQueue.length) {
      doSearch(missingQueue[missingIndex].title);
    }
  }, [step, missingIndex, missingQueue, doSearch]);

  // 이미지 선택 → 저장 → 다음 곡
  async function handleSaveMissing(item) {
    const currentSong = missingQueue[missingIndex];
    const key = item.imageUrl;
    setSaveState(s => ({ ...s, [key]: 'loading' }));

    let imageData = null;
    if (item.isBase64 || item.imageUrl.startsWith('data:')) {
      imageData = item.imageUrl;
    } else {
      imageData = await downloadImageAsBase64(item.imageUrl);
    }

    const newScore = saveScore({
      title: currentSong.title,
      key: currentSong.key || '',
      category: 'AI추천',
      imageData,
      sourceUrl: item.isBase64 ? '' : item.imageUrl,
    });

    setSaveState(s => ({ ...s, [key]: 'done' }));

    const newAddedIds = [...addedScoreIds, newScore.id];
    setAddedScoreIds(newAddedIds);

    setTimeout(() => moveToNext(newAddedIds), 600);
  }

  function handleSkip() {
    moveToNext(addedScoreIds);
  }

  function moveToNext(currentAddedIds) {
    const next = missingIndex + 1;
    if (next >= missingQueue.length) {
      doCreateConti(baseScoreIds, currentAddedIds, result);
    } else {
      setMissingIndex(next);
      setSearchResults([]);
      setSaveState({});
    }
  }

  function doCreateConti(baseIds, addedIds, aiResult) {
    // matchedScore에 imageData(수 MB base64)가 포함되어 있어
    // localStorage 저장 전 반드시 제거해야 함
    const aiRefToSave = {
      ...aiResult,
      sections: aiResult.sections.map(({ songs, ...section }) => ({
        ...section,
        songs: songs.map(({ matchedScore, ...song }) => song),
      })),
    };
    const newConti = saveConti({
      title:       aiResult.title || '새 콘티',
      date:        new Date().toISOString().slice(0, 10),
      worshipType: '주일예배',
      paperSize:   'A4',
      orientation: 'portrait',
      divisions:   2,
      scoreIds:    [...baseIds, ...addedIds],
      aiRef:       aiRefToSave,
    });
    navigate(`/editor/${newConti.id}`);
    onClose();
  }

  const matchedCount = result?.sections.reduce((acc, s) =>
    acc + s.songs.filter(g => g.matchedScore).length, 0) ?? 0;
  const totalSongs = result?.sections.reduce((acc, s) =>
    acc + s.songs.length, 0) ?? 0;

  // ─── add-missing 단계 UI ──────────────────────────────────
  if (step === 'add-missing') {
    const currentSong = missingQueue[missingIndex];
    const total       = missingQueue.length;
    const progress    = ((missingIndex) / total) * 100;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">

          {/* 헤더 */}
          <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl">
            <Search size={20} className="text-white" />
            <div className="flex-1">
              <h2 className="font-bold text-base text-white">
                악보 추가 중 ({missingIndex + 1} / {total})
              </h2>
              <p className="text-white/70 text-xs mt-0.5">라이브러리에 없는 곡의 악보를 선택하세요</p>
            </div>
            <button onClick={onClose}><X size={20} className="text-white/70 hover:text-white" /></button>
          </div>

          {/* 진행 바 */}
          <div className="h-1 bg-purple-100">
            <div
              className="h-1 bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 현재 곡 정보 */}
          <div className="px-6 pt-4 pb-3 flex-shrink-0 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">지금 추가할 곡</p>
                <div className="flex items-center gap-2">
                  <Music size={18} className="text-indigo-500" />
                  <span className="font-bold text-slate-800 text-lg">{currentSong.title}</span>
                  {currentSong.key && (
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                      {currentSong.key}조
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <SkipForward size={15} />
                건너뛰기
              </button>
            </div>

            {searchError && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                {searchError}
              </div>
            )}
          </div>

          {/* 검색 결과 */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {searchLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Loader size={28} className="animate-spin" />
                <span className="text-sm">"{currentSong.title}" 악보 검색 중…</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-sm gap-2">
                <Search size={32} className="opacity-30" />
                검색 결과가 없습니다
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {searchResults.map((item, idx) => {
                  const key   = item.imageUrl;
                  const state = saveState[key] || 'idle';
                  const thumb = item.thumbnail || item.imageUrl;

                  return (
                    <div
                      key={`${key}-${idx}`}
                      className="group relative bg-slate-50 rounded-xl overflow-hidden border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all"
                    >
                      <div className="aspect-[3/4] overflow-hidden bg-slate-100">
                        <img
                          src={thumb}
                          alt={item.title || currentSong.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                          onError={e => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML =
                              '<div class="w-full h-full flex items-center justify-center text-xs text-slate-300">미리보기 없음</div>';
                          }}
                        />
                      </div>

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
                              저장 중…
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSaveMissing(item)}
                              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-indigo-700 shadow-lg"
                            >
                              <Download size={13} />
                              이 악보 추가
                            </button>
                          )}
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
              </div>
            )}
          </div>

          {/* 하단 */}
          <div className="px-6 py-3 border-t flex-shrink-0 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              이미지를 선택하거나 건너뛰기를 눌러 다음으로 이동하세요
            </span>
            <div className="flex gap-1.5">
              {missingQueue.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i < missingIndex ? 'bg-green-400' :
                    i === missingIndex ? 'bg-indigo-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── 메인 UI (input / result) ─────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl">
          <Sparkles size={20} className="text-white" />
          <h2 className="font-bold text-lg text-white flex-1">AI 찬양 콘티 생성</h2>
          <button onClick={onClose}>
            <X size={20} className="text-white/70 hover:text-white" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {(error === 'API_KEY_NOT_SET' || error === 'API_KEY_INVALID') ? (
            <ApiKeyGuide invalid={error === 'API_KEY_INVALID'} />
          ) : (
            <div className="p-6 space-y-5">

              {/* 입력 영역 */}
              {!result && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      어떤 콘티가 필요하세요?
                    </label>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder={`예시:\n예레미야 39장 찬양 콘티 짜줘.\n- 예배를 여는 찬양 (10분)\n- 기도\n- 예배\n- 예배 기도회 찬양 (5~10분)\n- 축도\n- 파송찬양 1곡`}
                      rows={6}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                      autoFocus
                    />
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 mb-2">빠른 입력</p>
                    <div className="flex flex-col gap-2">
                      {QUICK_TEMPLATES.map((t, i) => (
                        <button key={i} onClick={() => setInput(t)}
                          className="text-left text-xs px-3 py-2 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 rounded-lg border border-slate-100 transition-colors">
                          {t.split('\n')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                      {error}
                    </div>
                  )}
                </>
              )}

              {/* 로딩 */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                  <Sparkles size={32} className="text-purple-400 animate-pulse" />
                  <p className="text-sm font-medium">Gemini가 콘티를 구성하는 중…</p>
                  <p className="text-xs text-slate-400">성경 본문과 예배 흐름을 분석하고 있습니다</p>
                  <Loader size={18} className="animate-spin text-purple-400 mt-2" />
                </div>
              )}

              {/* 결과 */}
              {result && !loading && (
                <div className="space-y-4">
                  <div className="bg-purple-50 rounded-xl px-4 py-3">
                    <p className="font-bold text-purple-800 text-base">{result.title}</p>
                    {result.bibleRef && (
                      <p className="text-xs text-purple-600 mt-0.5 flex items-center gap-1">
                        <BookOpen size={12} /> {result.bibleRef}
                      </p>
                    )}
                    <p className="text-sm text-purple-700 mt-1">{result.theme}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        총 {totalSongs}곡 추천
                      </span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        내 라이브러리 {matchedCount}곡 매칭
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {result.sections.map((section, si) => (
                      <div key={si} className="border border-slate-100 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {section.hasSongs
                              ? <Music size={14} className="text-indigo-500" />
                              : <span className="text-slate-400 text-xs">🙏</span>
                            }
                            <span className="text-sm font-semibold text-slate-700">{section.name}</span>
                          </div>
                          {section.duration && (
                            <span className="text-xs text-slate-400">{section.duration}</span>
                          )}
                        </div>

                        {section.hasSongs && section.songs.length > 0 && (
                          <div className="divide-y divide-slate-50">
                            {section.songs.map((song, gi) => (
                              <div key={gi} className="px-4 py-3 flex items-start gap-3">
                                {song.matchedScore ? (
                                  <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-slate-800">{song.title}</span>
                                    {song.key && (
                                      <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                                        {song.key}
                                      </span>
                                    )}
                                    {song.matchedScore ? (
                                      <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
                                        라이브러리 있음
                                      </span>
                                    ) : (
                                      <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
                                        악보 검색 필요
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">{song.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {!section.hasSongs && (
                          <p className="px-4 py-3 text-xs text-slate-400">찬양 없음</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {result.note && (
                    <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 flex items-start gap-2">
                      <Sparkles size={13} className="text-purple-400 flex-shrink-0 mt-0.5" />
                      {result.note}
                    </div>
                  )}

                  <button onClick={() => { setResult(null); setInput(''); }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline">
                    다시 입력하기
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        {!loading && (
          <div className="px-6 py-4 border-t flex-shrink-0">
            {!result ? (
              <button
                onClick={handleGenerate}
                disabled={!input.trim() || loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-40 transition-all"
              >
                <Sparkles size={16} />
                AI 콘티 생성
                <Send size={14} />
              </button>
            ) : (
              <div>
                <button
                  onClick={handleProceed}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-all"
                >
                  <Music size={16} />
                  콘티 만들기 ({totalSongs}곡)
                  <ChevronRight size={16} />
                </button>
                {totalSongs > matchedCount && (
                  <p className="text-xs text-amber-600 text-center mt-1.5">
                    라이브러리에 없는 {totalSongs - matchedCount}곡은 악보를 직접 선택합니다
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── API 키 설정 안내 ────────────────────────────────────────
function ApiKeyGuide({ invalid }) {
  return (
    <div className="px-8 py-8 flex flex-col items-center text-center gap-4">
      <KeyRound size={36} className="text-purple-400" />
      <h3 className="font-bold text-slate-800 text-lg">
        {invalid ? 'API 키가 올바르지 않습니다' : 'Gemini API 키 설정이 필요합니다'}
      </h3>
      <p className="text-slate-500 text-sm leading-relaxed">
        {invalid
          ? 'API 키를 확인하고 .env 파일을 수정해주세요.'
          : 'Google AI Studio에서 무료 API 키를 발급받아 설정해주세요.'}
      </p>

      <ol className="text-left space-y-4 w-full max-w-sm text-sm text-slate-700">
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
          <div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
              className="text-purple-600 underline font-medium">aistudio.google.com/app/apikey</a> 접속<br />
            <span className="text-xs text-slate-400">Google 계정으로 로그인 후 "Create API Key" 클릭</span>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
          <div>생성된 키를 복사</div>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
          <div>
            프로젝트의 <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">.env</code> 파일 수정:
            <pre className="bg-slate-800 text-green-400 rounded-lg p-3 text-xs mt-1.5 text-left overflow-x-auto">
{`VITE_GEMINI_API_KEY=여기에_복사한_키`}
            </pre>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
          <div>
            개발 서버 재시작: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">npm run dev</code>
          </div>
        </li>
      </ol>

      <div className="bg-purple-50 rounded-xl px-4 py-3 text-xs text-purple-700 w-full text-left">
        ✅ 무료 한도: 분당 15회, 하루 100만 토큰 (개인 사용에 충분)
      </div>
    </div>
  );
}
