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

export interface PollHistoryItem {
  date: string; // YYYY-MM-DD (UTC 기준 현재 로직과 동일)
  poll: PollData;
  votes: VoteData;
}

export interface UserVoteRecord {
  question: string;
  choice: "A" | "B";
  timestamp: number;
}

// 설문 질문 가져오기
export async function getPollData(): Promise<PollData> {
  if (isDev) {
    const data = devStore.get("poll:today");
    return (
      data || {
        question: "커피 vs 차",
        left: { label: "커피", emoji: "☕" },
        right: { label: "차", emoji: "🍵" },
      }
    );
  }
  const data = await kv.get<PollData>("poll:today");
  return (
    data || {
      question: "커피 vs 차",
      left: { label: "커피", emoji: "☕" },
      right: { label: "차", emoji: "🍵" },
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
  
  // Vercel KV에서는 A와 B를 따로 저장하므로 따로 조회
  const A = (await kv.get<number>("poll:votes:A")) || 0;
  const B = (await kv.get<number>("poll:votes:B")) || 0;
  
  return { A, B };
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

// ========== 내일 Poll 관련 함수 ==========

// 내일 poll 가져오기
export async function getTomorrowPoll(): Promise<PollData | null> {
  if (isDev) {
    return devStore.get("poll:tomorrow") || null;
  }
  return (await kv.get<PollData>("poll:tomorrow")) || null;
}

// 내일 poll 저장
export async function setTomorrowPoll(data: PollData): Promise<void> {
  if (isDev) {
    devStore.set("poll:tomorrow", data);
    return;
  }
  await kv.set("poll:tomorrow", data);
}

// 내일 poll 삭제
export async function deleteTomorrowPoll(): Promise<void> {
  if (isDev) {
    devStore.delete("poll:tomorrow");
    return;
  }
  await kv.del("poll:tomorrow");
}

// 마지막 업데이트 날짜 저장/조회
export async function getLastUpdateDate(): Promise<string | null> {
  if (isDev) {
    return devStore.get("poll:last_update") || null;
  }
  return (await kv.get<string>("poll:last_update")) || null;
}

export async function setLastUpdateDate(date: string): Promise<void> {
  if (isDev) {
    devStore.set("poll:last_update", date);
    return;
  }
  await kv.set("poll:last_update", date);
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getYesterdayDate(today: string): string {
  const d = new Date(today + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

// 히스토리 스냅샷 저장 (중복 방지)
export async function saveHistorySnapshot(date?: string): Promise<boolean> {
  const dateKey = date || getTodayDate();
  const historyKey = `poll:history:${dateKey}`;

  if (isDev) {
    if (devStore.get(historyKey)) return false;
    const poll = await getPollData();
    const votes = await getVoteData();
    const item: PollHistoryItem = { date: dateKey, poll, votes };
    devStore.set(historyKey, item);
    return true;
  }

  const exists = await kv.exists(historyKey);
  if (exists) return false;
  const poll = await getPollData();
  const votes = await getVoteData();
  const item: PollHistoryItem = { date: dateKey, poll, votes };
  await kv.set(historyKey, item);
  return true;
}

export async function getHistoryByDate(date: string): Promise<PollHistoryItem | null> {
  const historyKey = `poll:history:${date}`;
  if (isDev) {
    return devStore.get(historyKey) || null;
  }
  return (await kv.get<PollHistoryItem>(historyKey)) || null;
}

// 자정에 자동으로 내일 poll을 오늘 poll로 전환
export async function checkAndPromoteTomorrowPoll(): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const lastUpdate = await getLastUpdateDate();

  // 이미 오늘 업데이트했으면 스킵
  if (lastUpdate === today) {
    return false;
  }

  // 자정 진입 시, 전일 결과를 히스토리로 저장 (중복 방지)
  const snapshotDate = lastUpdate || getYesterdayDate(today);
  try { await saveHistorySnapshot(snapshotDate); } catch {}

  // 내일 poll이 있으면 오늘 poll로 승격
  const tomorrowPoll = await getTomorrowPoll();
  if (tomorrowPoll) {
    await setPollData(tomorrowPoll);
    await deleteTomorrowPoll();
    await resetVotes();
    await setLastUpdateDate(today);
    return true;
  }

  // 내일 poll이 없어도 날짜는 업데이트
  await setLastUpdateDate(today);
  return false;
}

// ========== 사용자 중복 투표 방지 ==========

// 사용자가 현재 질문에 이미 투표했는지 확인
export async function checkUserVoted(userHash: string, currentQuestion: string): Promise<boolean> {
  const key = `vote:user:${userHash}`;
  
  if (isDev) {
    const record = devStore.get(key) as UserVoteRecord | undefined;
    return record?.question === currentQuestion;
  }
  
  const record = await kv.get<UserVoteRecord>(key);
  return record?.question === currentQuestion;
}

// 사용자 투표 기록 저장
export async function recordUserVote(userHash: string, question: string, choice: "A" | "B"): Promise<void> {
  const key = `vote:user:${userHash}`;
  const record: UserVoteRecord = {
    question,
    choice,
    timestamp: Date.now(),
  };
  
  if (isDev) {
    devStore.set(key, record);
    return;
  }
  
  // KV에 저장 (질문이 바뀌면 자동으로 덮어씌워짐)
  await kv.set(key, record);
}

