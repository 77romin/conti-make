const PROXY_BASE = 'http://localhost:3001';

/** 구글 이미지 검색 (DuckDuckGo 경유) */
export async function searchImages(query, page = 1) {
  if (!(await checkServer())) throw new Error('SERVER_NOT_RUNNING');

  const url = `${PROXY_BASE}/api/images?q=${encodeURIComponent(query)}&page=${page}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 이미지 URL → base64 변환
 * 백엔드 서버를 통해 다운로드 → CORS 오류 없음
 */
export async function downloadImageAsBase64(imageUrl) {
  if (imageUrl.startsWith('data:')) return imageUrl;

  const proxyUrl = `${PROXY_BASE}/api/download?url=${encodeURIComponent(imageUrl)}`;
  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const { dataUrl } = await res.json();
    return dataUrl || null;
  } catch {
    return null;
  }
}

async function checkServer() {
  try {
    const res = await fetch(`${PROXY_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
