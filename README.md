# 📊 Poll - 매일 하나씩 가벼운 설문조사

간단하고 우아한 인터페이스로 매일 새로운 설문조사에 참여할 수 있는 Next.js 웹사이트입니다.

## ✨ 특징

- 🎨 **아름다운 UI**: Tailwind CSS로 만든 현대적인 디자인
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 지원
- 💾 **로컬 스토리지**: 투표 기록이 자동으로 저장됨
- 📊 **실시간 통계**: 투표 결과를 실시간으로 확인
- 🎯 **매일 업데이트**: 자정마다 새로운 설문조사 제공
- 🌐 **한국어 지원**: 완전한 한국어 UI

## 🚀 시작하기

### 필수 요구사항
- Node.js 18.0 이상
- npm 또는 yarn

### 설치

1. **저장소 클론 (또는 프로젝트 폴더 진입)**
```bash
cd poll
```

2. **의존성 설치**
```bash
npm install
```

3. **개발 서버 시작**
```bash
npm run dev
```

4. **브라우저에서 확인**
```
http://localhost:3000
```

## 📁 프로젝트 구조

```
poll/
├── app/
│   ├── components/
│   │   ├── PollCard.tsx        # 메인 설문조사 카드 컴포넌트
│   │   └── PollOption.tsx      # 각 선택지 컴포넌트
│   ├── data/
│   │   └── polls.ts            # 설문조사 데이터
│   ├── globals.css             # 전역 스타일
│   ├── layout.tsx              # 루트 레이아웃
│   └── page.tsx                # 메인 페이지
├── public/                     # 정적 파일
├── next.config.ts              # Next.js 설정
├── tailwind.config.ts          # Tailwind CSS 설정
├── tsconfig.json               # TypeScript 설정
└── package.json                # 프로젝트 의존성
```

## 🎨 사용된 기술

- **Next.js 15** - React 프레임워크
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 유틸리티 CSS 프레임워크
- **React Hooks** - 상태 관리

## 💡 주요 기능

### 1. 매일 다른 설문조사
- `getTodaysPoll()` 함수로 오늘의 설문조사를 자동으로 표시
- 날짜 기반으로 설문조사가 변경됨

### 2. 투표 기능
- 클릭으로 간단하게 투표
- 투표 후 결과를 즉시 확인 가능
- 로컬 스토리지에 자동 저장

### 3. 실시간 통계
- 투표율(%)을 시각적으로 표시
- 총 투표 수 표시
- 진행 바로 결과 표시

## 🔧 커스터마이징

### 새로운 설문조사 추가

`app/data/polls.ts` 파일을 수정하여 새로운 설문조사를 추가할 수 있습니다:

```typescript
{
  id: 6,
  question: "당신의 질문은?",
  options: [
    { id: 1, text: "선택지 1", votes: 0 },
    { id: 2, text: "선택지 2", votes: 0 },
    { id: 3, text: "선택지 3", votes: 0 },
  ],
  date: "2025-10-23",
}
```

## 📦 빌드 및 배포

### 프로덕션 빌드
```bash
npm run build
npm start
```

### Vercel 배포 (추천)
1. [Vercel](https://vercel.com)에 회원가입
2. GitHub와 연결
3. 저장소 연결하면 자동 배포

## 🤝 기여

개선 제안이나 버그 리포트는 언제든 환영합니다!

## 📄 라이선스

MIT License

## 👨‍💻 작성자

Poll Team - 2025

---

**즐거운 설문조사 경험되세요! 🎉**
