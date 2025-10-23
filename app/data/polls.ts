// 매일 바뀌는 설문조사 데이터
export interface Poll {
  id: number;
  question: string;
  options: {
    id: number;
    text: string;
    votes: number;
  }[];
  date: string;
}

// 일주일치 설문조사 예제
export const pollsData: Poll[] = [
  {
    id: 1,
    question: "오늘 기분이 어떠신가요?",
    options: [
      { id: 1, text: "😊 최고야!", votes: 0 },
      { id: 2, text: "😐 그냥 그래", votes: 0 },
      { id: 3, text: "😢 별로야", votes: 0 },
    ],
    date: new Date().toISOString().split("T")[0],
  },
  {
    id: 2,
    question: "커피 vs 차, 뭘 더 좋아하세요?",
    options: [
      { id: 1, text: "☕ 커피!", votes: 0 },
      { id: 2, text: "🍵 차!", votes: 0 },
      { id: 3, text: "🥤 둘 다 좋아", votes: 0 },
    ],
    date: new Date(new Date().setDate(new Date().getDate() - 1))
      .toISOString()
      .split("T")[0],
  },
  {
    id: 3,
    question: "주말에는 뭐 하는 걸 좋아하세요?",
    options: [
      { id: 1, text: "🏠 집에서 쉬기", votes: 0 },
      { id: 2, text: "🎬 영화/드라마 보기", votes: 0 },
      { id: 3, text: "🏃 운동/활동하기", votes: 0 },
    ],
    date: new Date(new Date().setDate(new Date().getDate() - 2))
      .toISOString()
      .split("T")[0],
  },
  {
    id: 4,
    question: "밤 10시 이후에도 집중이 잘 되나요?",
    options: [
      { id: 1, text: "✅ 잘 돼!", votes: 0 },
      { id: 2, text: "⚠️ 중간정도", votes: 0 },
      { id: 3, text: "❌ 안 돼", votes: 0 },
    ],
    date: new Date(new Date().setDate(new Date().getDate() - 3))
      .toISOString()
      .split("T")[0],
  },
  {
    id: 5,
    question: "최근에 본 영화나 드라마 있으신가요?",
    options: [
      { id: 1, text: "🎬 있어요!", votes: 0 },
      { id: 2, text: "🤔 생각 중", votes: 0 },
      { id: 3, text: "❌ 없어요", votes: 0 },
    ],
    date: new Date(new Date().setDate(new Date().getDate() - 4))
      .toISOString()
      .split("T")[0],
  },
];

// 오늘의 설문조사 가져오기
export function getTodaysPoll(): Poll {
  const today = new Date().toISOString().split("T")[0];
  const poll = pollsData.find((p) => p.date === today);
  return poll || pollsData[0];
}

