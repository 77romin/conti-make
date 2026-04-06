/**
 * 콘티메이크 백엔드 프록시 서버 - DuckDuckGo 이미지 검색
 *
 * 구글은 자동화 접근을 CAPTCHA로 차단하기 때문에,
 * DuckDuckGo 이미지 검색을 사용합니다.
 * DuckDuckGo는 내부적으로 Bing/구글 인덱스를 사용하므로
 * 실제 이미지 결과는 동일합니다.
 *
 * 원리:
 *   1. DuckDuckGo 검색 페이지에서 보안 토큰(vqd) 획득
 *   2. 해당 토큰으로 이미지 JSON API 호출
 *   3. 이미지 URL + 썸네일 목록 반환
 */

const express = require('express');
const axios   = require('axios');
const cors    = require('cors');

const app  = express();
const PORT = 3001;

app.use(cors({ origin: /^http:\/\/localhost(:\d+)?$/ }));

// 브라우저처럼 보이게 하는 공통 헤더
const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
};

/**
 * Step 1: DuckDuckGo 검색 페이지에서 vqd 토큰 획득
 * vqd는 DuckDuckGo가 검색 세션을 추적하는 토큰입니다.
 * 이미지 API 호출 시 반드시 필요합니다.
 */
async function getVqd(query) {
  const res = await axios.get('https://duckduckgo.com/', {
    params: { q: query, iax: 'images', ia: 'images' },
    headers: BROWSER_HEADERS,
    timeout: 10000,
  });

  // HTML에서 vqd 값 추출
  // 형식: vqd="4-xxxx" 또는 vqd='4-xxxx'
  const match = res.data.match(/vqd=["']?([\d-]+)["']?/);
  if (!match) throw new Error('vqd 토큰을 찾지 못했습니다. DuckDuckGo 응답 형식이 변경되었을 수 있습니다.');
  return match[1];
}

/**
 * Step 2: vqd 토큰으로 이미지 검색 결과 JSON 가져오기
 */
async function fetchImages(query, vqd, page = 1) {
  const offset = (page - 1) * 20;  // 20개씩 페이지네이션

  const res = await axios.get('https://duckduckgo.com/i.js', {
    params: {
      q:   query,
      o:   'json',
      p:   1,
      s:   offset,
      u:   'bing',      // Bing 인덱스 사용 (= 구글 인덱스와 유사)
      f:   ',,,,,',
      l:   'wt-wt',     // 지역 설정 (제한 없음)
      vqd: vqd,
    },
    headers: {
      ...BROWSER_HEADERS,
      'Accept':  'application/json',
      'Referer': `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
    },
    timeout: 10000,
  });

  return res.data;
}

// ─── API 엔드포인트 ──────────────────────────────────────────

/**
 * GET /api/images?q=검색어&page=1
 */
app.get('/api/images', async (req, res) => {
  const query = req.query.q?.trim();
  const page  = parseInt(req.query.page) || 1;

  if (!query) return res.status(400).json({ error: '검색어를 입력해주세요.' });

  // 악보 검색에 최적화: '악보' 키워드 자동 추가
  const searchQuery = query.includes('악보') ? query : `${query} 악보`;

  try {
    console.log(`[검색] "${searchQuery}" (페이지 ${page})`);

    // Step 1: 토큰 획득
    const vqd = await getVqd(searchQuery);

    // Step 2: 이미지 목록 가져오기
    const data = await fetchImages(searchQuery, vqd, page);

    // Step 3: 필요한 필드만 추려서 반환
    const items = (data.results || []).map(item => ({
      imageUrl:  item.image,       // 원본 이미지 URL (고화질)
      thumbnail: item.thumbnail,   // 썸네일 URL (미리보기용)
      title:     item.title || '',
      width:     item.width,
      height:    item.height,
      source:    item.url,         // 출처 페이지 URL
    }));

    console.log(`  → ${items.length}개 결과`);
    res.json({ items, page, hasMore: items.length >= 20 });

  } catch (err) {
    console.error('[오류]', err.message);
    res.status(500).json({ error: `검색 오류: ${err.message}` });
  }
});

/**
 * GET /api/download?url=이미지URL
 *
 * 브라우저는 외부 이미지를 직접 fetch하면 CORS 오류가 납니다.
 * 이 엔드포인트가 서버에서 이미지를 대신 가져와 base64로 변환해 반환합니다.
 * → CORS 없음, 팝업 없음, 빠른 저장 가능
 */
app.get('/api/download', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).json({ error: 'url 파라미터가 필요합니다.' });

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 12000,
      headers: {
        // 이미지 서버에 일반 브라우저처럼 보이게 함
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept':     'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer':    new URL(imageUrl).origin,
      },
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';

    // 이미지가 아닌 응답(HTML 오류 페이지 등) 차단
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: '이미지 파일이 아닙니다.' });
    }

    // base64로 변환해서 반환
    const base64 = Buffer.from(response.data).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log(`[다운로드] ${imageUrl.slice(0, 60)}… (${Math.round(base64.length / 1024)}KB)`);
    res.json({ dataUrl });

  } catch (err) {
    console.error('[다운로드 실패]', err.message);
    res.status(500).json({ error: '이미지 다운로드 실패: ' + err.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`\n✅ 콘티메이크 프록시 서버 실행 중`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   이미지 검색: DuckDuckGo (API 키 없음, 무료)\n`);
});
