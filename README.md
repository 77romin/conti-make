# 콘티메이크 (ContiMake)

> 한국 교회 예배 찬양 인도자를 위한 **AI 기반 악보 관리 & 콘티 생성 웹앱**

---

## 서비스 목적

교회 찬양 인도자는 매주 예배 순서(콘티)를 직접 구성하고, 각 곡의 악보를 정리해 팀원과 공유해야 합니다. 기존에는 악보를 개별적으로 수집하고 배치하는 과정이 수동으로 이루어져 많은 시간이 소요되었습니다.

**콘티메이크**는 이 과정을 자동화합니다.
- 악보를 이미지로 검색해 라이브러리에 저장
- AI에게 예배 요청을 자연어로 입력하면 콘티를 자동 생성
- 생성된 콘티를 A4/A3 레이아웃으로 편집하고 PDF로 출력

---

## 주요 기능

### 악보 라이브러리
- DuckDuckGo 이미지 검색을 통한 악보 이미지 수집
- 곡명, 키(조성), 카테고리 태그로 관리
- 라이브러리에 저장된 악보를 콘티에 자유롭게 배치

### AI 콘티 자동 생성
- Gemini AI에 자연어로 예배 요청 입력 (예: "예레미야 39장 기반 주일 예배 콘티 짜줘")
- 예배 주제에 맞는 곡을 자유롭게 추천 (라이브러리 보유 여부 무관)
- 라이브러리에 있는 곡은 자동 매칭, 없는 곡은 악보 검색 화면이 자동으로 열려 이미지 선택 가능
- 생성 당시 AI 레퍼런스(제목·주제·섹션별 선곡 이유)를 편집기에서 언제든 다시 확인 가능

### 콘티 편집기
- A4 / A3, 세로 / 가로 방향 선택
- 1분할 / 2분할 / 4분할 레이아웃
- 악보 드래그 앤 드롭 정렬 (@dnd-kit)
- 곡 추가 시 페이지 자동 확장
- UI 요소 제외한 깔끔한 PDF 저장 (html2canvas-pro + jsPDF)

### 데이터 관리
- 모든 데이터 브라우저 localStorage 저장 (서버 불필요)
- 백업 / 복원 기능

---

## 사용 기술

| 분류 | 기술 |
|------|------|
| 프론트엔드 | React 18, Vite, React Router v6 |
| 스타일링 | Tailwind CSS v4 (`@tailwindcss/vite`) |
| 드래그 앤 드롭 | @dnd-kit/core, @dnd-kit/sortable |
| PDF 생성 | jsPDF + html2canvas-pro |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| 이미지 검색 | DuckDuckGo 비공식 API (vqd 토큰 방식) |
| 백엔드 프록시 | Node.js + Express (CORS 우회, 이미지 다운로드) |
| 데이터 저장 | localStorage |

---

## 시스템 구조

```
[브라우저 (React)]
    │
    ├── Gemini API (직접 호출) ──→ AI 콘티 생성
    │
    └── Express 프록시 서버 (localhost:3001)
            ├── /api/images   ──→ DuckDuckGo 이미지 검색
            └── /api/download ──→ 외부 이미지 base64 변환 (CORS 해결)
```

---

## 난관과 해결법

### 1. 구글 이미지 검색 CAPTCHA 차단
**문제:** 구글 이미지 검색을 Puppeteer/크롤링으로 시도했으나, 자동화 탐지로 CAPTCHA가 발생해 사용 불가.  
**해결:** DuckDuckGo 비공식 이미지 API로 전환. vqd 토큰을 먼저 발급받고 이미지 목록을 요청하는 2단계 방식으로 구현.

### 2. 외부 이미지 CORS 오류
**문제:** 브라우저에서 외부 이미지 URL을 직접 fetch하면 CORS 정책으로 차단됨.  
**해결:** Express 백엔드에 `/api/download` 엔드포인트를 추가. 서버가 이미지를 가져와 base64로 변환 후 클라이언트에 반환, 팝업이나 CORS 오류 없이 처리.

### 3. PDF에 oklch() 색상 오류
**문제:** Tailwind CSS v4가 `oklch()` 색상 함수를 사용하는데, `html2canvas`가 이를 지원하지 않아 PDF 생성 시 오류 발생.  
**해결:** `html2canvas`를 `html2canvas-pro`로 교체. oklch를 포함한 최신 CSS 색상 함수를 지원.

### 4. PDF에 UI 요소가 포함되는 문제
**문제:** PDF 저장 시 드래그 핸들, X 버튼, 헤더 등 편집 UI가 그대로 출력됨.  
**해결:** 두 가지 방식 병행 적용.
- 레이아웃에 영향을 주지 않는 요소: `data-html2canvas-ignore="true"` 속성
- 헤더처럼 레이아웃에 영향을 주는 요소: `isPrintMode` state + `flushSync` + `requestAnimationFrame`으로 DOM 업데이트 후 캡처

### 5. 다중 페이지 PDF 생성
**문제:** 악보가 많아 1장을 초과할 때 여러 페이지를 하나의 PDF로 합쳐야 함.  
**해결:** 각 페이지 DOM을 `pageRefs[]` 배열로 관리, html2canvas로 개별 캡처 후 jsPDF에 순서대로 추가.

### 6. Gemini 모델 지원 중단
**문제:** 초기 사용하던 `gemini-2.0-flash` 모델이 신규 사용자에게 지원 중단됨.  
**해결:** Gemini ListModels API를 직접 호출해 실제 사용 가능한 모델 목록 확인 후, `gemini-2.5-flash`로 교체.

### 7. AI 추천 곡 악보 자동 추가 흐름
**문제:** AI가 추천한 곡이 라이브러리에 없을 경우, 빈 항목으로 추가되어 콘티에 실제 악보가 없는 상태가 됨.  
**해결:** 라이브러리에 없는 곡이 있으면 "악보 추가" 단계로 자동 전환. 해당 곡명으로 이미지를 자동 검색하고, 사용자가 이미지를 선택하면 라이브러리에 저장 후 다음 곡으로 순서대로 진행.

### 8. 이미지 검색 CORS 포트 하드코딩 문제
**문제:** 백엔드 서버(`server.js`)의 CORS 허용 origin이 `http://localhost:5174`로 하드코딩되어 있었음. Vite는 해당 포트가 사용 중이면 5175, 5176 등으로 자동 변경하는데, 이 경우 이미지 검색 요청이 CORS 정책에 의해 차단됨.  
**해결:** CORS origin을 정규식 `/^http:\/\/localhost(:\d+)?$/`으로 변경해 포트 번호에 관계없이 localhost 전체를 허용.

### 9. AI가 라이브러리 곡 위주로 추천하는 문제
**문제:** Gemini 프롬프트에 라이브러리 목록을 전달하면, "라이브러리를 고려하지 말라"는 지시를 줘도 AI가 눈앞에 보이는 곡을 자연스럽게 선택해 라이브러리 곡만 추천하는 경향이 생김.  
**해결:** 라이브러리 목록을 Gemini 프롬프트에서 완전히 제거. AI는 오직 예배 주제와 흐름만 보고 자유롭게 추천하고, 라이브러리 매칭은 응답 수신 후 클라이언트에서 곡명 비교로 처리.

### 10. '콘티 만들기' 버튼 무반응 (localStorage 용량 초과)
**문제:** AI 결과 데이터를 `aiRef`로 저장할 때, 각 곡의 `matchedScore` 객체 안에 악보 이미지의 base64 인코딩 데이터(수 MB)가 포함된 채 localStorage에 쓰려고 해서 `QuotaExceededError` 발생. 이 오류가 catch되지 않아 버튼이 아무 반응 없이 멈추는 것처럼 보였음.  
**해결:** `doCreateConti`에서 `aiRef` 저장 전에 각 song 객체의 `matchedScore` 필드를 구조 분해로 제거한 뒤 저장.

---

## 환경 설정

### 1. 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/YOUR_USERNAME/conti-make.git
cd conti-make
npm install
cd backend && npm install && cd ..
```

### 2. 환경변수 설정

`.env.example`을 복사해 `.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일에 API 키 입력:

```env
VITE_GEMINI_API_KEY=여기에_Gemini_API_키_입력
```

> Gemini API 키 무료 발급: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### 3. 실행

터미널 두 개에서 각각 실행:

```bash
# 터미널 1 - 프론트엔드
npm run dev

# 터미널 2 - 백엔드 프록시
cd backend && node server.js
```

브라우저에서 `http://localhost:5173` 접속

---

## 프로젝트 구조

```
conti-make/
├── src/
│   ├── components/
│   │   ├── AiContiGenerator.jsx  # AI 콘티 생성 모달
│   │   ├── Navbar.jsx            # 상단 네비게이션
│   │   ├── ScoreCard.jsx         # 악보 카드 컴포넌트
│   │   └── ScoreSearch.jsx       # 악보 이미지 검색 모달
│   ├── pages/
│   │   ├── Home.jsx              # 콘티 목록 홈
│   │   ├── Library.jsx           # 악보 라이브러리
│   │   ├── ContiEditor.jsx       # 콘티 편집기
│   │   └── Settings.jsx          # 설정 / 백업
│   └── utils/
│       ├── gemini.js             # Gemini AI API 연동
│       ├── imageSearch.js        # 이미지 검색 유틸
│       ├── pdfGenerator.js       # PDF 생성 유틸
│       └── storage.js            # localStorage 관리
├── backend/
│   └── server.js                 # Express 프록시 서버
└── .env.example                  # 환경변수 템플릿
```

---

## 라이선스

개인 포트폴리오 프로젝트입니다.
