// localStorage를 이용한 데이터 저장소
// 브라우저에 데이터를 저장하고 불러오는 모든 함수를 여기에 모아둠

const KEYS = {
  SCORES: 'conti_scores',      // 악보 목록
  CONTIS: 'conti_list',        // 콘티 목록
};

// ─── 악보 관련 ──────────────────────────────────────

/** 악보 전체 목록 불러오기 */
export function getScores() {
  const raw = localStorage.getItem(KEYS.SCORES);
  return raw ? JSON.parse(raw) : [];
}

/** 악보 저장 (새로 추가) */
export function saveScore(score) {
  const scores = getScores();
  const newScore = {
    id: Date.now().toString(),
    title: score.title || '제목 없음',
    category: score.category || '',
    key: score.key || '',          // 악보 키(코드): C, G, D 등
    imageData: score.imageData,    // base64 이미지 데이터
    sourceUrl: score.sourceUrl || '',
    createdAt: new Date().toISOString(),
  };
  scores.unshift(newScore); // 최신 항목이 앞에 오도록
  localStorage.setItem(KEYS.SCORES, JSON.stringify(scores));
  return newScore;
}

/** 악보 수정 */
export function updateScore(id, updates) {
  const scores = getScores();
  const idx = scores.findIndex(s => s.id === id);
  if (idx === -1) return null;
  scores[idx] = { ...scores[idx], ...updates };
  localStorage.setItem(KEYS.SCORES, JSON.stringify(scores));
  return scores[idx];
}

/** 악보 삭제 */
export function deleteScore(id) {
  const scores = getScores().filter(s => s.id !== id);
  localStorage.setItem(KEYS.SCORES, JSON.stringify(scores));
}

// ─── 콘티 관련 ──────────────────────────────────────

/** 콘티 전체 목록 불러오기 */
export function getContis() {
  const raw = localStorage.getItem(KEYS.CONTIS);
  return raw ? JSON.parse(raw) : [];
}

/** 콘티 저장 (새로 추가) */
export function saveConti(conti) {
  const contis = getContis();
  const newConti = {
    id: Date.now().toString(),
    title: conti.title || '새 콘티',
    date: conti.date || new Date().toISOString().slice(0, 10),
    worshipType: conti.worshipType || '주일예배',
    paperSize: conti.paperSize || 'A4',      // 'A4' | 'A3'
    divisions: conti.divisions || 4,          // 분할 수
    scoreIds: conti.scoreIds || [],           // 배치된 악보 ID 배열
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  contis.unshift(newConti);
  localStorage.setItem(KEYS.CONTIS, JSON.stringify(contis));
  return newConti;
}

/** 콘티 수정 */
export function updateConti(id, updates) {
  const contis = getContis();
  const idx = contis.findIndex(c => c.id === id);
  if (idx === -1) return null;
  contis[idx] = { ...contis[idx], ...updates, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEYS.CONTIS, JSON.stringify(contis));
  return contis[idx];
}

/** 콘티 삭제 */
export function deleteConti(id) {
  const contis = getContis().filter(c => c.id !== id);
  localStorage.setItem(KEYS.CONTIS, JSON.stringify(contis));
}

// ─── 백업 / 복원 ─────────────────────────────────────

/** 전체 데이터를 JSON 문자열로 내보내기 */
export function exportBackup() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    scores: getScores(),
    contis: getContis(),
  }, null, 2);
}

/** JSON 문자열을 가져와 복원 */
export function importBackup(jsonString) {
  const data = JSON.parse(jsonString);
  if (!data.scores || !data.contis) throw new Error('올바른 백업 파일이 아닙니다.');
  localStorage.setItem(KEYS.SCORES, JSON.stringify(data.scores));
  localStorage.setItem(KEYS.CONTIS, JSON.stringify(data.contis));
}
