# 🎯 Poll 사용 가이드

**Poll**은 Next.js 기반의 매일 업데이트되는 가벼운 설문조사 웹사이트입니다. 이 가이드는 사용자가 설문조사에 참여하는 방법과 개발자가 프로젝트를 커스터마이징하는 방법을 설명합니다.

---

## 📱 사용자 가이드

### 1️⃣ 설문조사 참여하기

#### 웹사이트 방문
1. `http://localhost:3000`에 접속합니다
2. 화면 중앙에 오늘의 설문조사가 표시됩니다

#### 투표 방법
1. 제시된 선택지 중 마음에 드는 항목을 클릭합니다
2. 투표가 완료되면 결과가 실시간으로 표시됩니다
3. 투표율(%)과 총 투표 수를 확인할 수 있습니다

#### 투표 기록
- 이미 투표했다면 다시 투표할 수 없습니다
- 브라우저의 로컬 스토리지에 투표 기록이 저장됩니다
- 브라우저를 닫아도 투표 기록이 유지됩니다

### 2️⃣ 히스토리 확인하기

1. 메인 페이지 우측 상단의 **"📜 히스토리"** 버튼을 클릭합니다
2. 과거의 모든 설문조사와 결과를 확인할 수 있습니다
3. 각 설문의 투표율을 시각적 그래프로 볼 수 있습니다

### 3️⃣ 매일 새로운 설문

- **자동 업데이트**: 매일 자정에 새로운 설문조사가 제공됩니다
- **날짜 확인**: 각 설문 상단의 날짜를 통해 언제의 설문인지 확인할 수 있습니다

---

## 👨‍💻 개발자 가이드

### 📦 프로젝트 시작하기

```bash
# 1. 프로젝트 폴더로 이동
cd poll

# 2. 의존성 설치
npm install

# 3. 개발 서버 시작
npm run dev

# 4. 브라우저에서 확인
# http://localhost:3000
```

### 🏗️ 프로젝트 구조

```
poll/
├── app/
│   ├── api/
│   │   └── polls/
│   │       └── today/
│   │           └── route.ts          # API: 오늘의 설문조사 반환
│   ├── components/
│   │   ├── PollCard.tsx              # 메인 설문 카드
│   │   ├── PollOption.tsx            # 개별 선택지 버튼
│   │   └── PollHistory.tsx           # 과거 설문 목록
│   ├── data/
│   │   └── polls.ts                  # 설문 데이터 저장소
│   ├── history/
│   │   └── page.tsx                  # 히스토리 페이지
│   ├── globals.css                   # 전역 스타일
│   ├── layout.tsx                    # 루트 레이아웃
│   └── page.tsx                      # 메인 페이지
├── public/                           # 정적 파일
├── next.config.ts                    # Next.js 설정
├── tailwind.config.ts                # Tailwind 설정
├── tsconfig.json                     # TypeScript 설정
└── package.json                      # 프로젝트 의존성
```

### 🔧 주요 기능 구현

#### 1. 설문 데이터 구조

```typescript
// app/data/polls.ts
interface Poll {
  id: number;                          // 고유 ID
  question: string;                    // 질문
  options: Array<{
    id: number;                        // 선택지 ID
    text: string;                      # 선택지 텍스트
    votes: number;                     // 투표 수
  }>;
  date: string;                        // 날짜 (YYYY-MM-DD)
}
```

#### 2. 오늘의 설문 가져오기

```typescript
// app/data/polls.ts
export function getTodaysPoll(): Poll {
  const today = new Date().toISOString().split("T")[0];
  const poll = pollsData.find((p) => p.date === today);
  return poll || pollsData[0];
}
```

#### 3. 투표 기능

```typescript
// app/components/PollCard.tsx
const handleVote = (optionId: number) => {
  // 투표 수 증가
  const updatedOptions = pollData.options.map((opt) => {
    if (opt.id === optionId) {
      return { ...opt, votes: opt.votes + 1 };
    }
    return opt;
  });

  // 로컬 스토리지에 저장
  const voteData = {
    optionId,
    votes: Object.fromEntries(
      updatedOptions.map((opt) => [opt.id, opt.votes])
    ),
  };
  localStorage.setItem(`poll-${poll.id}`, JSON.stringify(voteData));
};
```

### ➕ 새로운 설문조사 추가하기

1. `app/data/polls.ts` 파일을 엽니다
2. `pollsData` 배열에 새로운 설문을 추가합니다:

```typescript
{
  id: 6,
  question: "당신의 새로운 질문은?",
  options: [
    { id: 1, text: "첫 번째 선택지", votes: 0 },
    { id: 2, text: "두 번째 선택지", votes: 0 },
    { id: 3, text: "세 번째 선택지", votes: 0 },
  ],
  date: "2025-10-24", // YYYY-MM-DD 형식
}
```

### 🎨 스타일 커스터마이징

#### 배경색 변경

```css
/* app/globals.css */
body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

#### Tailwind CSS 클래스 사용

모든 컴포넌트는 Tailwind CSS를 사용합니다:

```typescript
// 예: 버튼 스타일
<button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
  클릭하기
</button>
```

### 🚀 빌드 및 배포

#### 로컬 빌드 테스트

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

#### Vercel에 배포 (추천)

```bash
# 1. npm으로 Vercel CLI 설치
npm install -g vercel

# 2. Vercel에 로그인
vercel login

# 3. 프로젝트 배포
vercel
```

### 📡 API 라우트

#### GET `/api/polls/today`

오늘의 설문조사 데이터를 JSON 형식으로 반환합니다.

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "question": "오늘 기분이 어떠신가요?",
    "options": [
      { "id": 1, "text": "😊 최고야!", "votes": 0 },
      { "id": 2, "text": "😐 그냥 그래", "votes": 0 }
    ],
    "date": "2025-10-23"
  }
}
```

### 🔍 디버깅 팁

#### 1. 개발 서버 재시작
변경사항이 반영되지 않으면 개발 서버를 다시 시작하세요:
```bash
npm run dev
```

#### 2. 로컬 스토리지 초기화
투표 기록을 삭제하려면 브라우저 개발자 도구에서:
1. F12를 눌러 개발자 도구를 엽니다
2. Application 탭 > Local Storage 선택
3. 관련 항목 삭제

#### 3. ESLint 검사
코드 품질을 확인하세요:
```bash
npm run lint
```

---

## 📋 추가 기능 아이디어

이러한 기능들을 추가하여 프로젝트를 확장할 수 있습니다:

1. **데이터베이스 연동**: Firebase 또는 MongoDB를 사용하여 투표 데이터 저장
2. **사용자 인증**: 사용자별 투표 기록 관리
3. **통계 페이지**: 고급 차트와 분석 도구
4. **공유 기능**: SNS 공유, QR 코드
5. **알림**: 새로운 설문조사 알림 기능
6. **다국어 지원**: 영어, 중국어 등 추가 언어
7. **다크 모드**: 야간 모드 지원
8. **카테고리**: 설문조사를 카테고리별로 분류

---

## 🐛 문제 해결

### Q: 투표가 저장되지 않습니다
**A:** 브라우저의 로컬 스토리지가 비활성화되어 있거나 시크릿 모드를 사용 중일 수 있습니다.

### Q: 매일 새로운 설문이 자동으로 업데이트되지 않습니다
**A:** 현재는 수동으로 `polls.ts`에 설문을 추가해야 합니다. 자동 스케줄링을 원한다면 cron 작업을 추가하세요.

### Q: 배포 후 스타일이 깨져 보입니다
**A:** 캐시 문제일 수 있습니다. 브라우저 캐시를 지우거나 Ctrl+Shift+R을 눌러 강제 새로고침하세요.

---

## 📚 참고 자료

- [Next.js 공식 문서](https://nextjs.org/docs)
- [React 공식 문서](https://react.dev)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs)

---

**Happy polling! 🎉**

