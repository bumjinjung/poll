# 📊 Poll - 매일 하나씩 가벼운 설문조사

간단하고 우아한 인터페이스로 매일 새로운 설문조사에 참여할 수 있는 Next.js 웹사이트입니다.

## ✨ 주요 기능

- 🎨 **아름다운 UI**: Tailwind CSS로 만든 현대적인 디자인과 부드러운 애니메이션
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 완벽 지원
- 🗳️ **투표 시스템**: 중복 투표 방지, 선택지별 투표 카운트
- 📊 **실시간 통계**: SSE(Server-Sent Events)로 투표 결과를 실시간으로 확인
- ⏰ **자정 자동 전환**: 매일 자정에 자동으로 새로운 설문조사로 전환
- 📜 **히스토리 관리**: 과거 설문조사 결과 저장 및 조회
- 👤 **관리자 페이지**: 설문조사 관리, 내일 질문 미리 설정
- 🔐 **사용자 인증**: IP + User-Agent 기반 사용자 추적
- 💾 **데이터 저장**: Vercel KV 또는 로컬 스토리지
- 🔄 **즉시 반영**: 관리자 페이지에서 질문 수정 시 모든 탭에 즉시 반영
- 🚫 **캐시 비활성화**: 항상 최신 데이터 보장

## 🚀 시작하기

### 1. 환경 준비

- Node.js ≥ v18.x  
- npm 또는 yarn
- Vercel 계정 (프로덕션 배포용)

### 2. 저장소 클론 및 설치

```bash
git clone https://github.com/username/poll.git
cd poll
npm install
```

### 3. 환경 변수 설정

프로덕션 환경의 경우 Vercel KV와 관리자 키를 설정해야 합니다:

```env
# .env.local
KV_URL=your-vercel-kv-url
KV_REST_API_URL=your-vercel-kv-rest-api-url
KV_REST_API_TOKEN=your-vercel-kv-token
ADMIN_KEY=your-admin-key
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

### 5. 개발 데이터 관리

개발 모드에서는 자동으로 `.dev-data.json` 파일을 생성하여 로컬 데이터를 관리합니다:

```bash
# 개발 데이터 초기화 후 재시작
npm run dev:reset
```

## 📁 프로젝트 구조

```
poll/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   └── today/          # 오늘/내일 설문 설정 API
│   │   ├── vote/               # 투표 API
│   │   │   └── stream/         # SSE 실시간 업데이트 API
│   │   └── history/            # 히스토리 조회 API
│   ├── admin/                  # 관리자 페이지
│   ├── history/                # 히스토리 페이지
│   ├── components/
│   │   └── PollClient.tsx      # 메인 설문조사 컴포넌트
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   └── kv.ts                   # KV 저장소 관리 (Vercel KV / 로컬)
├── scripts/
├── .dev-data.json              # 개발용 로컬 데이터
└── package.json
```

## 🎨 사용된 기술

- **Next.js 16** - React 프레임워크 (App Router)
- **TypeScript** - 타입 안전성
- **Tailwind CSS 4** - 유틸리티 CSS 프레임워크
- **Vercel KV** - Key-Value 저장소
- **React Hooks** - 상태 관리
- **Server-Sent Events (SSE)** - 실시간 데이터 업데이트
- **BroadcastChannel API** - 브라우저 탭 간 통신

## 💡 주요 기능 상세

### 1. 투표 시스템

- **중복 투표 방지**: IP + User-Agent 기반 사용자 추적
- **실시간 업데이트**: SSE를 통한 투표 결과 즉시 반영
- **사용자 투표 기록**: 질문이 변경되어도 투표 기록 유지
- **깜빡임 방지**: `pendingChoice` 상태로 투표 중 버튼 색상 유지

### 2. 관리자 페이지 (`/admin`)

- **오늘 질문 관리**: 현재 설문조사 수정
- **내일 질문 설정**: 내일 나올 질문 미리 등록
- **투표 초기화**: 투표 수를 0으로 리셋
- **히스토리 조회**: 과거 설문조사 확인
- **즉시 반영**: 질문 수정 시 모든 탭에 즉시 반영 (BroadcastChannel + localStorage)

### 3. 자정 자동 전환

매일 자정(KST)에 자동으로 실행되는 전환 로직:

1. 어제의 설문조사와 투표 결과를 히스토리로 저장
2. 미리 설정된 "내일 질문"이 있으면 오늘 질문으로 승격
3. 투표 수 초기화

### 4. 히스토리 관리

- **과거 설문조사 보관**: 날짜별로 과거 설문조사와 투표 결과 저장
- **히스토리 페이지**: 사용자가 과거 설문조사를 조회 가능
- **데이터 수정**: 관리자가 과거 투표 결과 수정 가능

### 5. 실시간 통신

- **SSE (Server-Sent Events)**: 투표 수 실시간 업데이트
- **BroadcastChannel**: 브라우저 탭 간 즉시 통신
- **localStorage 이벤트**: 크로스 탭 데이터 동기화
- **캐시 비활성화**: 항상 최신 데이터 보장

### 6. 사용자 경험

- **부드러운 애니메이션**: 투표 결과 표시 시 자연스러운 전환 효과
- **로딩 상태**: 데이터 업데이트 중 로딩 인디케이터
- **반응형 레이아웃**: 모든 화면 크기에서 최적화
- **깜빡임 방지**: 투표 중 버튼 색상 안정적 유지


## 📦 빌드 및 배포

### 프로덕션 빌드

```bash
npm run build
npm start
```

### Vercel 배포 (추천)

1. GitHub에 저장소 푸시
2. [Vercel](https://vercel.com)에 로그인
3. 새 프로젝트 추가 → GitHub 저장소 선택
4. 환경 변수 설정:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `ADMIN_KEY`
5. 배포 완료!

## 🔐 보안

- **관리자 키**: API 요청 시 `ADMIN_KEY` 헤더 필수
- **사용자 추적**: IP + User-Agent 해시로 중복 투표 방지
- **환경 변수**: 민감한 정보는 환경 변수로 관리

## 📄 API 엔드포인트

### 투표 API
- `GET /api/vote` - 투표 결과 조회
- `POST /api/vote` - 투표하기
- `GET /api/vote/stream` - SSE 실시간 투표 수 업데이트

### 관리자 API
- `GET /api/admin/today` - 오늘/내일 설문 조회 (캐시 비활성화)
- `POST /api/admin/today` - 오늘/내일 설문 설정 (캐시 비활성화)

### 히스토리 API
- `GET /api/history` - 히스토리 목록 조회
- `GET /api/history/[date]` - 특정 날짜 히스토리 조회

## 🤝 기여

개선 제안이나 버그 리포트는 언제든 환영합니다!

## 📄 라이선스

MIT License

## 👨‍💻 작성자

Poll Team - 2025

---

**즐거운 설문조사 경험되세요! 🎉**
