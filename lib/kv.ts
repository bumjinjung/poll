import { kv } from "@vercel/kv";

// 개발 환경에서는 메모리 저장소 사용
const isDev = process.env.NODE_ENV === "development";

// 개발용 메모리 저장소
const devStore = new Map<string, any>();

export interface PollData {
  question: string;
  left: { label: string; emoji: string };
  right: { label: string; emoji: string };
}

export interface VoteData {
  A: number;
  B: number;
}

// 설문 질문 가져오기
export async function getPollData(): Promise<PollData> {
  if (isDev) {
    const data = devStore.get("poll:today");
    return (
      data || {
        question: "이성친구 가능 VS 불가능",
        left: { label: "가능", emoji: "🙆" },
        right: { label: "불가능", emoji: "🙅" },
      }
    );
  }
  const data = await kv.get<PollData>("poll:today");
  return (
    data || {
      question: "이성친구 가능 VS 불가능",
      left: { label: "가능", emoji: "🙆" },
      right: { label: "불가능", emoji: "🙅" },
    }
  );
}

// 설문 질문 저장
export async function setPollData(data: PollData): Promise<void> {
  if (isDev) {
    devStore.set("poll:today", data);
    return;
  }
  await kv.set("poll:today", data);
}

// 투표 결과 가져오기
export async function getVoteData(): Promise<VoteData> {
  if (isDev) {
    const data = devStore.get("poll:votes");
    return data || { A: 0, B: 0 };
  }
  const data = await kv.get<VoteData>("poll:votes");
  return data || { A: 0, B: 0 };
}

// 투표 추가 (원자적 연산)
export async function addVote(choice: "A" | "B"): Promise<VoteData> {
  if (isDev) {
    const current = devStore.get("poll:votes") || { A: 0, B: 0 };
    const updated = {
      A: choice === "A" ? current.A + 1 : current.A,
      B: choice === "B" ? current.B + 1 : current.B,
    };
    devStore.set("poll:votes", updated);
    return updated;
  }

  // Vercel KV에서 원자적 증가
  const key = `poll:votes:${choice}`;
  await kv.incr(key);

  const A = (await kv.get<number>("poll:votes:A")) || 0;
  const B = (await kv.get<number>("poll:votes:B")) || 0;

  return { A, B };
}

// 투표 초기화 (새 질문 등록시)
export async function resetVotes(): Promise<void> {
  if (isDev) {
    devStore.set("poll:votes", { A: 0, B: 0 });
    return;
  }
  await kv.set("poll:votes:A", 0);
  await kv.set("poll:votes:B", 0);
}

