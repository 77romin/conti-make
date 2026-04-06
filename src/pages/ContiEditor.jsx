import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, Download, Eye, Plus, X, GripVertical, Settings2,
  RectangleHorizontal, RectangleVertical, FileText,
  Sparkles, BookOpen, Music, CheckCircle, XCircle,
} from 'lucide-react';
import { getScores, getContis, saveConti, updateConti } from '../utils/storage';
import { generatePDF, previewPDF } from '../utils/pdfGenerator';

const PAPER_MM = { A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 } };

const LAYOUT_OPTIONS = {
  portrait: {
    A4: [
      { label: '1분할', cols: 1, rows: 1, max: 1 },
      { label: '2분할', cols: 1, rows: 2, max: 2 },
      { label: '4분할', cols: 2, rows: 2, max: 4 },
    ],
    A3: [
      { label: '2분할', cols: 1, rows: 2, max: 2 },
      { label: '4분할', cols: 2, rows: 2, max: 4 },
      { label: '6분할', cols: 2, rows: 3, max: 6 },
      { label: '8분할', cols: 2, rows: 4, max: 8 },
    ],
  },
  landscape: {
    A4: [
      { label: '1분할', cols: 1, rows: 1, max: 1 },
      { label: '2분할', cols: 2, rows: 1, max: 2 },
      { label: '4분할', cols: 2, rows: 2, max: 4 },
    ],
    A3: [
      { label: '2분할', cols: 2, rows: 1, max: 2 },
      { label: '4분할', cols: 2, rows: 2, max: 4 },
      { label: '6분할', cols: 3, rows: 2, max: 6 },
      { label: '8분할', cols: 4, rows: 2, max: 8 },
    ],
  },
};

const WORSHIP_TYPES = ['주일예배', '수요예배', '금요기도회', '새벽예배', '기타'];

/** scoreIds 배열을 pageSize 크기의 청크로 나눔 */
function chunkArray(arr, size) {
  if (size < 1) return [arr];
  const pages = [];
  for (let i = 0; i < arr.length; i += size) {
    pages.push(arr.slice(i, i + size));
  }
  return pages.length > 0 ? pages : [[]];
}

// ─── 드래그 가능한 악보 셀 ──────────────────────────────────
function SortableScoreCell({ scoreId, score, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scoreId });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="relative bg-white border border-slate-200 overflow-hidden w-full h-full"
    >
      {(score?.imageData || score?.imageUrl) ? (
        <img
          src={score.imageData || score.imageUrl}
          alt={score?.title}
          className="w-full h-full object-contain"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-50">
          <p className="text-xs text-slate-400 text-center px-2">{score?.title || '?'}</p>
        </div>
      )}

      {/* 드래그 핸들 — PDF 출력 시 제외 */}
      <button
        data-html2canvas-ignore="true"
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 w-6 h-6 bg-white/80 rounded flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={13} className="text-slate-500" />
      </button>

      {/* 하단 제목 오버레이 — PDF 출력 시 제외 */}
      <div
        data-html2canvas-ignore="true"
        className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-2 py-0.5 truncate"
      >
        {score?.title}
      </div>

      {/* 삭제 버튼 — PDF 출력 시 제외 */}
      <button
        data-html2canvas-ignore="true"
        onClick={() => onRemove(scoreId)}
        className="absolute top-1 right-1 w-6 h-6 bg-white/80 rounded-full flex items-center justify-center hover:bg-red-50"
      >
        <X size={12} className="text-red-500" />
      </button>
    </div>
  );
}

// ─── 빈 셀 ──────────────────────────────────────────────────
function EmptyCell() {
  return (
    <div className="w-full h-full bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
      <span className="text-xs text-slate-300">비어있음</span>
    </div>
  );
}

// ─── 한 페이지 (제목 헤더 + 악보 그리드) ──────────────────────
// forwardRef를 사용하면 부모가 DOM ref를 받아 PDF 캡처에 사용할 수 있음
import { forwardRef } from 'react';

const ContiPage = forwardRef(function ContiPage(
  { meta, layout, containerW, containerH, scoreIds, scoreMap, onRemove, pageNum, totalPages, isPrintMode },
  ref
) {
  // PDF 출력 시 헤더를 숨기고 악보가 페이지 전체를 채우게 함
  const HEADER_H = isPrintMode ? 0 : 48;
  const gridH    = containerH - HEADER_H;

  return (
    <div
      ref={ref}
      style={{ width: containerW, height: containerH }}
      className="bg-white border border-slate-200 shadow-xl overflow-hidden flex-shrink-0"
    >
      {/* 헤더 — 화면에서만 표시, PDF 출력 시 숨김 */}
      {!isPrintMode && (
        <div
          style={{ height: HEADER_H }}
          className="bg-slate-800 text-white flex items-center justify-between px-4 flex-shrink-0"
        >
          <div>
            <p className="font-bold text-sm leading-tight">{meta.title}</p>
            <p className="text-xs text-slate-400">{meta.date} · {meta.worshipType}</p>
          </div>
          <span className="text-xs text-slate-500 flex-shrink-0">
            {pageNum} / {totalPages}
          </span>
        </div>
      )}

      {/* 악보 그리드 — PDF 출력 시 전체 페이지 채움 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows:    `repeat(${layout.rows}, 1fr)`,
          width:  containerW,
          height: gridH,
        }}
      >
        {scoreIds.map(sid => (
          <SortableScoreCell
            key={sid}
            scoreId={sid}
            score={scoreMap[sid]}
            onRemove={onRemove}
          />
        ))}
        {Array.from({ length: layout.max - scoreIds.length }).map((_, i) => (
          <EmptyCell key={`empty-${i}`} />
        ))}
      </div>
    </div>
  );
});

// ─── 메인 편집기 ────────────────────────────────────────────
export default function ContiEditor() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const isNew     = id === 'new';

  const [meta, setMeta] = useState({
    title:       '새 콘티',
    date:        new Date().toISOString().slice(0, 10),
    worshipType: '주일예배',
    paperSize:   'A4',
    orientation: 'portrait',
    layoutIdx:   2,
  });

  const [scoreIds, setScoreIds]             = useState([]);
  const [library, setLibrary]               = useState([]);
  const [showScorePicker, setShowScorePicker] = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [isPrinting, setIsPrinting]         = useState(false);
  const [isPrintMode, setIsPrintMode]       = useState(false); // PDF 캡처 중 UI 숨김 모드
  const [aiRef, setAiRef]                   = useState(null);
  const [showAiRef, setShowAiRef]           = useState(false);

  // 페이지별 DOM ref 배열 — PDF 캡처에 사용
  const pageRefs = useRef([]);

  const sensors = useSensors(useSensor(PointerSensor));

  // 기존 콘티 불러오기
  useEffect(() => {
    setLibrary(getScores());
    if (!isNew) {
      const conti = getContis().find(c => c.id === id);
      if (conti) {
        const orient = conti.orientation || 'portrait';
        const opts   = LAYOUT_OPTIONS[orient][conti.paperSize];
        const idx    = opts.findIndex(l => l.max === conti.divisions);
        setMeta({
          title:       conti.title,
          date:        conti.date,
          worshipType: conti.worshipType,
          paperSize:   conti.paperSize,
          orientation: orient,
          layoutIdx:   idx >= 0 ? idx : 2,
        });
        setScoreIds(conti.scoreIds || []);
        setAiRef(conti.aiRef || null);
      }
    }
  }, [id, isNew]);

  // 현재 레이아웃
  const layoutOptions = LAYOUT_OPTIONS[meta.orientation][meta.paperSize];
  const layout        = layoutOptions[meta.layoutIdx] || layoutOptions[layoutOptions.length - 1];
  const perPage       = layout.max;   // 한 페이지당 악보 수

  // 악보 맵
  const scoreMap = Object.fromEntries(library.map(s => [s.id, s]));

  // 용지 실제 비율
  const paperMM   = PAPER_MM[meta.paperSize];
  const paperW    = meta.orientation === 'landscape' ? paperMM.h : paperMM.w;
  const paperH    = meta.orientation === 'landscape' ? paperMM.w : paperMM.h;

  // 미리보기 크기 (px)
  const CONTAINER_W = 520;
  const containerH  = Math.round(CONTAINER_W * (paperH / paperW));

  // ── 핵심: scoreIds를 perPage 단위로 잘라 페이지 배열 생성 ──
  const pages      = chunkArray(scoreIds, perPage);
  const totalPages = pages.length;

  // pageRefs 배열 크기를 페이지 수에 맞춤
  pageRefs.current = pageRefs.current.slice(0, totalPages);

  // 드래그&드롭: 전체 scoreIds 기준으로 순서 변경 (페이지 간 이동 포함)
  function handleDragEnd({ active, over }) {
    if (over && active.id !== over.id) {
      setScoreIds(ids => {
        const from = ids.indexOf(active.id);
        const to   = ids.indexOf(over.id);
        return arrayMove(ids, from, to);
      });
    }
  }

  // 악보 추가 — 제한 없음, 꽉 차면 다음 페이지로 자동 추가
  function addScore(scoreId) {
    if (scoreIds.includes(scoreId)) {
      setScoreIds(ids => ids.filter(i => i !== scoreId));
    } else {
      setScoreIds(ids => [...ids, scoreId]);
    }
  }

  function removeScore(scoreId) {
    setScoreIds(ids => ids.filter(i => i !== scoreId));
  }

  // 저장
  async function handleSave() {
    setIsSaving(true);
    const data = {
      title:       meta.title,
      date:        meta.date,
      worshipType: meta.worshipType,
      paperSize:   meta.paperSize,
      orientation: meta.orientation,
      divisions:   perPage,
      scoreIds,
    };
    if (isNew) {
      const saved = saveConti(data);
      navigate(`/editor/${saved.id}`, { replace: true });
    } else {
      updateConti(id, data);
    }
    setIsSaving(false);
    alert('저장되었습니다!');
  }

  // PDF 캡처 공통 헬퍼
  // 1) isPrintMode=true → React 리렌더링 + 브라우저 페인팅 대기
  // 2) html2canvas 캡처
  // 3) isPrintMode=false 복원
  async function capturePages() {
    // flushSync: 상태 변경을 즉시 DOM에 반영
    flushSync(() => setIsPrintMode(true));
    // 브라우저가 실제로 화면을 그릴 때까지 2프레임 대기
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const elements = pageRefs.current.filter(Boolean);
    return elements;
  }

  async function handleDownload() {
    if (scoreIds.length === 0) { alert('악보를 먼저 추가해주세요.'); return; }
    setIsPrinting(true);
    try {
      const elements = await capturePages();
      await generatePDF(elements, `${meta.title}.pdf`, meta.paperSize, meta.orientation);
    } catch (e) {
      alert('PDF 생성 중 오류가 발생했습니다: ' + e.message);
    } finally {
      setIsPrintMode(false);
      setIsPrinting(false);
    }
  }

  async function handlePreview() {
    if (scoreIds.length === 0) { alert('악보를 먼저 추가해주세요.'); return; }
    setIsPrinting(true);
    try {
      const elements = await capturePages();
      const url = await previewPDF(elements, meta.paperSize, meta.orientation);
      window.open(url, '_blank');
    } catch (e) {
      alert('미리보기 생성 오류: ' + e.message);
    } finally {
      setIsPrintMode(false);
      setIsPrinting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ── 상단 툴바 ── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm">
          <ArrowLeft size={18} /> 뒤로
        </button>

        <input
          type="text"
          value={meta.title}
          onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
          className="flex-1 min-w-0 text-xl font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none py-1 transition-colors"
          placeholder="콘티 제목"
        />

        <div className="flex items-center gap-2 ml-auto">
          {aiRef && (
            <button onClick={() => setShowAiRef(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-purple-200 text-purple-700 bg-purple-50 rounded-lg text-sm font-medium hover:bg-purple-100">
              <Sparkles size={15} /> AI 레퍼런스
            </button>
          )}
          <button onClick={handleSave} disabled={isSaving}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
            {isSaving ? '저장 중…' : '저장'}
          </button>
          <button onClick={handlePreview} disabled={isPrinting}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            <Eye size={16} /> 미리보기
          </button>
          <button onClick={handleDownload} disabled={isPrinting}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            <Download size={16} />
            {isPrinting ? 'PDF 생성 중…' : 'PDF 저장'}
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── 왼쪽 설정 패널 ── */}
        <div className="w-52 flex-shrink-0 space-y-4">
          {/* 콘티 정보 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-3">
              <Settings2 size={15} /> 콘티 정보
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <input type="date" value={meta.date}
                  onChange={e => setMeta(m => ({ ...m, date: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">예배 종류</label>
                <select value={meta.worshipType}
                  onChange={e => setMeta(m => ({ ...m, worshipType: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                  {WORSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 레이아웃 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">레이아웃</h3>

            {/* 용지 크기 */}
            <div className="flex gap-2 mb-2">
              {['A4', 'A3'].map(size => (
                <button key={size}
                  onClick={() => setMeta(m => ({ ...m, paperSize: size, layoutIdx: 0 }))}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors
                    ${meta.paperSize === size ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {size}
                </button>
              ))}
            </div>

            {/* 용지 방향 */}
            <div className="flex gap-2 mb-3">
              {[
                { value: 'portrait',  label: '세로', Icon: RectangleVertical },
                { value: 'landscape', label: '가로', Icon: RectangleHorizontal },
              ].map(({ value, label, Icon }) => (
                <button key={value}
                  onClick={() => setMeta(m => ({ ...m, orientation: value, layoutIdx: 0 }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium border transition-colors
                    ${meta.orientation === value ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            {/* 분할 수 */}
            <div className="space-y-1.5">
              {layoutOptions.map((opt, idx) => (
                <button key={opt.label}
                  onClick={() => setMeta(m => ({ ...m, layoutIdx: idx }))}
                  className={`w-full py-1.5 px-3 rounded-lg text-sm text-left border transition-colors
                    ${meta.layoutIdx === idx ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium' : 'border-slate-100 text-slate-600 hover:bg-slate-50'}`}>
                  {opt.label} ({opt.cols}×{opt.rows})
                </button>
              ))}
            </div>
          </div>

          {/* 페이지/곡 수 표시 */}
          <div className="bg-indigo-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <FileText size={18} className="text-indigo-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-indigo-600 font-semibold">{totalPages}장 · {scoreIds.length}곡</p>
              <p className="text-xs text-indigo-400">장당 {perPage}곡</p>
            </div>
          </div>

          {/* 악보 추가 버튼 */}
          <button onClick={() => setShowScorePicker(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus size={16} />
            악보 추가 ({scoreIds.length}곡)
          </button>
        </div>

        {/* ── 오른쪽: 다중 페이지 미리보기 ── */}
        <div className="flex-1 min-w-0">
          <p className="text-center text-xs text-slate-400 mb-3">
            {meta.paperSize} {meta.orientation === 'landscape' ? '가로' : '세로'} · {layout.label} · {totalPages}페이지
          </p>

          {/* 스크롤 가능한 페이지 스택 */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={scoreIds} strategy={rectSortingStrategy}>
              <div className="flex flex-col items-center gap-6">
                {pages.map((pageScoreIds, pageIdx) => (
                  <div key={pageIdx} className="flex flex-col items-center">
                    <ContiPage
                      ref={el => { pageRefs.current[pageIdx] = el; }}
                      meta={meta}
                      layout={layout}
                      containerW={CONTAINER_W}
                      containerH={containerH}
                      scoreIds={pageScoreIds}
                      scoreMap={scoreMap}
                      onRemove={removeScore}
                      pageNum={pageIdx + 1}
                      totalPages={totalPages}
                      isPrintMode={isPrintMode}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* ── AI 레퍼런스 모달 ── */}
      {showAiRef && aiRef && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl">
              <Sparkles size={20} className="text-white" />
              <h2 className="font-bold text-lg text-white flex-1">AI 콘티 레퍼런스</h2>
              <button onClick={() => setShowAiRef(false)}>
                <X size={20} className="text-white/70 hover:text-white" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="bg-purple-50 rounded-xl px-4 py-3">
                <p className="font-bold text-purple-800 text-base">{aiRef.title}</p>
                {aiRef.bibleRef && (
                  <p className="text-xs text-purple-600 mt-0.5 flex items-center gap-1">
                    <BookOpen size={12} /> {aiRef.bibleRef}
                  </p>
                )}
                <p className="text-sm text-purple-700 mt-1">{aiRef.theme}</p>
              </div>

              <div className="space-y-3">
                {aiRef.sections.map((section, si) => (
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
                            {song.inLibrary
                              ? <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                              : <XCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-slate-800">{song.title}</span>
                                {song.key && (
                                  <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{song.key}</span>
                                )}
                                {song.inLibrary
                                  ? <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">라이브러리 있음</span>
                                  : <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">라이브러리 없음</span>
                                }
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

              {aiRef.note && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 flex items-start gap-2">
                  <Sparkles size={13} className="text-purple-400 flex-shrink-0 mt-0.5" />
                  {aiRef.note}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 악보 선택 팝업 ── */}
      {showScorePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="font-bold text-lg text-slate-800">악보 선택</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {scoreIds.length}곡 선택됨 · {totalPages}페이지 (장당 {perPage}곡)
                </p>
              </div>
              <button onClick={() => setShowScorePicker(false)}>
                <X size={20} className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {library.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-slate-400 mb-4">저장된 악보가 없습니다.</p>
                  <button
                    onClick={() => { setShowScorePicker(false); navigate('/library'); }}
                    className="text-indigo-600 text-sm font-medium">
                    악보 라이브러리에서 추가하기
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {library.map(score => {
                    const selected = scoreIds.includes(score.id);
                    return (
                      <div key={score.id} onClick={() => addScore(score.id)}
                        className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all
                          ${selected ? 'border-indigo-500 shadow-md' : 'border-transparent hover:border-slate-300'}`}>
                        <div className="aspect-[3/4] bg-slate-100">
                          {(score.imageData || score.imageUrl) ? (
                            <img src={score.imageData || score.imageUrl} alt={score.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 text-center p-1">{score.title}</div>
                          )}
                        </div>
                        <p className="text-xs text-center py-1 px-1 truncate font-medium text-slate-700">{score.title}</p>
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t">
              <button onClick={() => setShowScorePicker(false)}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                완료 ({scoreIds.length}곡 · {totalPages}페이지)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
