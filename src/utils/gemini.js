/**
 * Gemini AI 콘티 생성 유틸리티
 *
 * Gemini 2.0 Flash REST API를 직접 호출합니다.
 * (별도 npm 패키지 불필요 — fetch만 사용)
 */

const API_KEY   = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL   = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * 사용자 요청을 바탕으로 Gemini가 콘티를 생성합니다.
 * 라이브러리 매칭은 응답 수신 후 클라이언트에서 처리합니다.
 *
 * @param {string} userRequest  - 사용자가 입력한 자연어 요청
 * @returns {Promise<ContiResult>}
 */
export async function generateConti(userRequest) {
  if (!API_KEY || API_KEY === '여기에_GEMINI_API_키_입력') {
    throw new Error('API_KEY_NOT_SET');
  }

  const prompt = `당신은 한국 교회 예배 찬양 콘티 전문가입니다.
사용자의 요청에 맞게 예배 순서와 찬양 곡목을 구성해 주세요.

━━━ 사용자 요청 ━━━
${userRequest}

━━━ 작성 규칙 ━━━
1. 예배 주제와 흐름에 가장 잘 어울리는 곡을 자유롭게 선택하세요.
2. 기도·설교·축도처럼 찬양이 없는 섹션은 hasSongs: false로 표시하세요.
3. 각 곡 선택 이유를 한 문장으로 적어주세요.
4. 성경 본문이 언급되면 해당 본문의 주제에 어울리는 찬양을 선택하세요.
5. 한국 CCM, 복음성가, 경배와 찬양을 두루 활용하세요.

━━━ 응답 형식 (JSON만 출력) ━━━
{
  "title": "콘티 제목",
  "theme": "예배 주제 한 줄 요약",
  "bibleRef": "성경 본문 (없으면 null)",
  "sections": [
    {
      "name": "섹션 이름",
      "duration": "10분",
      "hasSongs": true,
      "songs": [
        {
          "title": "곡명",
          "key": "G",
          "reason": "선택 이유 한 문장"
        }
      ]
    },
    {
      "name": "기도",
      "duration": null,
      "hasSongs": false,
      "songs": []
    }
  ],
  "note": "전체 콘티 코멘트 한 줄"
}`;

  const res = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        // JSON 형식 강제 → 파싱 오류 방지
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || '';
    if (res.status === 400 && msg.includes('API_KEY')) throw new Error('API_KEY_INVALID');
    if (res.status === 429) throw new Error('QUOTA_EXCEEDED');
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.');

  return JSON.parse(text);
}
