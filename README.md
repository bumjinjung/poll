# 📊 Poll - 매일 하나씩 가벼운 설문조사

간단하고 우아한 인터페이스로 매일 새로운 설문조사에 참여할 수 있는 Next.js 웹사이트입니다.

## ✨ 주요 기능

- 🎨 **아름다운 UI**: Tailwind CSS로 만든 현대적인 디자인과 부드러운 애니메이션
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 완벽 지원
- 🗳️ **투표 시스템**: 쿠키 기반 사용자 추적, 중복 투표 방지
- 📊 **실시간 통계**: 탭 간 동기화 및 폴링으로 투표 결과를 실시간으로 확인
- ⏰ **자정 자동 전환**: 매일 자정에 자동으로 새로운 설문조사로 전환
- 📜 **히스토리 관리**: 과거 설문조사 결과 저장 및 조회
- 👤 **관리자 페이지**: 설문조사 관리, 내일 질문 미리 설정
- 🔐 **사용자 인증**: HttpOnly 쿠키 기반 사용자 추적 (1년 유지)
- 💾 **데이터 저장**: Vercel KV 또는 로컬 스토리지
- 🔄 **즉시 반영**: 관리자 페이지에서 질문 수정 시 모든 탭에 즉시 반영
- 🚫 **캐시 비활성화**: 항상 최신 데이터 보장
- ⚡ **성능 최적화**: 애니메이션 중복 방지, 서버 사이드 렌더링 최적화
- ✨ **깜빡임 제거**: 투표한 사용자는 첫 로드부터 결과 화면만 표시

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

- **Next.js 15** - React 프레임워크 (App Router, Server Components)
- **TypeScript** - 타입 안전성
- **Tailwind CSS 4** - 유틸리티 CSS 프레임워크
- **Vercel KV** - Key-Value 저장소 (Redis 기반)
- **React Hooks** - 상태 관리 (useState, useEffect, useRef, useCallback)
- **BroadcastChannel API** - 브라우저 탭 간 통신
- **HttpOnly Cookies** - 안전한 사용자 인증
- **Server-Side Rendering** - 초기 로드 최적화

## 💡 주요 기능 상세

### 1. 투표 시스템

- **쿠키 기반 사용자 추적**: HttpOnly 쿠키로 안전하게 사용자 식별 (1년 유지)
- **중복 투표 방지**: 사용자별 투표 기록을 Poll ID와 함께 저장
- **서버 사이드 초기화**: 첫 렌더링 전에 서버에서 투표 여부 확인
- **깜빡임 완전 제거**: 투표한 사용자는 선택지 화면을 전혀 보지 않음
- **실시간 동기화**: BroadcastChannel + 폴링으로 탭 간 데이터 동기화
- **사용자 투표 기록**: 질문이 변경되어도 투표 기록 유지

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

### 5. 실시간 통신 및 동기화

- **5초 간격 폴링**: 투표 수를 주기적으로 업데이트
- **BroadcastChannel**: 브라우저 탭 간 즉시 통신 (자기 메시지 무시)
- **localStorage 이벤트**: 크로스 탭 데이터 동기화
- **이벤트 디바운스**: focus/online/pageshow 이벤트 최적화 (200ms)
- **쿨다운 시스템**: 애니메이션 중 fetch 차단 (ANIM_MS + 300ms)
- **캐시 비활성화**: 항상 최신 데이터 보장

### 6. 사용자 경험 최적화

- **부드러운 애니메이션**: 1초간의 fillUp 애니메이션 (cubic-bezier)
- **애니메이션 중복 방지**: fillPlayed 플래그로 1회만 실행 보장
- **애니메이션 폴백**: onAnimationEnd 미호출 대비 타이머 (ANIM_MS + 200ms)
- **숫자 표시 타이밍**: 애니메이션 끝나기 직전(ANIM_MS - 200ms)에 표시
- **반응형 레이아웃**: 모든 화면 크기에서 최적화
- **모바일 최적화**: hover 지원 기기에서만 hover 효과 적용
- **Optimistic Update**: 투표 즉시 UI 업데이트 후 서버 동기화
- **실패 복구**: POST 실패 시 완전 롤백 및 상태 정상화

## 🐛 해결된 주요 문제

### 1. 시크릿 창 애니메이션 중복 실행 (2025-10-27)
**문제**: 시크릿 창에서 투표 시 애니메이션이 두 번 실행되는 현상
**해결**: 
- `fillPlayed` 플래그로 애니메이션 1회 실행 보장
- 쿨다운 시스템으로 애니메이션 중 fetch/폴링 차단
- 애니메이션 진행 중 BroadcastChannel 메시지 무시
- 폴링 일시 중지 후 ANIM_MS + 300ms 뒤 재개

### 2. 초기 화면 깜빡임 (2025-10-27)
**문제**: 투표한 사용자가 첫 로드 시 0.1초간 선택지 화면이 보이는 현상
**해결**:
- 서버 사이드에서 쿠키 확인 후 투표 여부 사전 판단
- `initialUserVote`를 PollClient에 전달하여 초기 상태 설정
- 첫 렌더링부터 올바른 화면(선택지/결과) 표시
- 클라이언트 사이드 스크립트 없이 SSR만으로 해결

### 3. 성능 최적화 (2025-10-27)
**개선 사항**:
- `fetchVotesAndConfig` deps 최소화 (`[config?.id]`)
- `animatedVotes` ref로 최신 값 참조 최적화
- focus/online/pageshow 이벤트 디바운스 (200ms)
- BroadcastChannel 안전 처리 (try-catch)
- 모바일 hover 효과 조건부 적용

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
- **HttpOnly 쿠키**: 사용자 ID를 안전하게 저장 (XSS 방지)
- **UUID 기반 추적**: crypto.randomUUID()로 고유한 사용자 식별
- **Secure 쿠키**: 프로덕션 환경에서 HTTPS 필수
- **SameSite 정책**: CSRF 공격 방지 (lax)
- **환경 변수**: 민감한 정보는 환경 변수로 관리

## 📄 API 엔드포인트

### 투표 API
- `GET /api/vote` - 투표 결과 및 사용자 투표 여부 조회
  - 응답: `{ success, votes, userVote }`
  - 쿠키가 없으면 자동 생성
- `POST /api/vote` - 투표하기
  - 요청: `{ choice: "A" | "B" }`
  - 응답: `{ success, votes }`
  - 중복 투표 방지 (403 에러)

### 관리자 API
- `GET /api/admin/today` - 오늘/내일 설문 조회
- `POST /api/admin/today` - 오늘/내일 설문 설정
- `POST /api/admin/auto-generate` - AI 설문 자동 생성
- `POST /api/admin/daily-rotation` - 일별 로테이션 수동 실행
- `POST /api/admin/fix-history` - 히스토리 데이터 수정
- `POST /api/admin/manual-history` - 히스토리 수동 추가

### 히스토리 API
- `GET /api/history` - 히스토리 목록 조회 (최신순)

## 🤝 기여

개선 제안이나 버그 리포트는 언제든 환영합니다!

## 📄 라이선스

MIT License

## 👨‍💻 작성자

Poll Team - 2025

---

**즐거운 설문조사 경험되세요! 🎉**
