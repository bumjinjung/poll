import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// 개발 환경에서는 메모리 저장소 사용
const isDev = process.env.NODE_ENV === "development";

// 개발용 메모리 저장소
const devStore = new Map<string, any>();

// 개발 환경 데이터 파일 경로
const DEV_DATA_FILE = path.join(process.cwd(), ".dev-data.json");

// 개발 데이터 로드
function loadDevData() {
  try {
    if (fs.existsSync(DEV_DATA_FILE)) {
      const data = fs.readFileSync(DEV_DATA_FILE, "utf-8");
      const parsed = JSON.parse(data);
      Object.entries(parsed).forEach(([key, value]) => {
        devStore.set(key, value);
      });
    }
    // 파일이 없으면 빈 상태로 시작
  } catch (error) {
    console.error("Failed to load dev data:", error);
  }
}

// 개발 데이터 저장
function saveDevData() {
  if (!isDev) return;
  try {
    const data: Record<string, any> = {};
    devStore.forEach((value, key) => {
      data[key] = value;
    });
    fs.writeFileSync(DEV_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save dev data:", error);
  }
}

// 앱 시작 시 데이터 로드
if (isDev) {
  loadDevData();
}

export interface PollData {
  id: string; // 설문 고유 ID
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
  poll: PollData | null;
  votes: VoteData;
}

export interface UserVoteRecord {
  pollId: string;
  choice: "A" | "B";
  timestamp: number;
}

// 설문 질문 가져오기
export async function getPollData(): Promise<PollData | null> {
  if (isDev) {
    // 개발 환경에서는 매번 파일에서 최신 데이터 읽기
    try {
      if (fs.existsSync(DEV_DATA_FILE)) {
        const data = fs.readFileSync(DEV_DATA_FILE, "utf-8");
        const parsed = JSON.parse(data);
        const pollData = parsed["poll:today"] || null;
        return pollData;
      }
    } catch (error) {
      console.error("Failed to read dev data file:", error);
    }
    // 파일이 없으면 메모리에서 읽기
    const data = devStore.get("poll:today") || null;
    return data;
  }
  const data = await kv.get<PollData>("poll:today");
  return data || null;
}

// 설문 질문 저장
export async function setPollData(data: PollData): Promise<void> {
  if (isDev) {
    devStore.set("poll:today", data);
    saveDevData();
    return;
  }
  await kv.set("poll:today", data);
}

// 설문 질문 삭제
export async function deletePollData(): Promise<void> {
  if (isDev) {
    devStore.delete("poll:today");
    saveDevData();
    return;
  }
  await kv.del("poll:today");
}

// 투표 결과 가져오기
export async function getVoteData(): Promise<VoteData> {
  if (isDev) {
    // 개발 환경에서는 매번 파일에서 최신 데이터 읽기
    try {
      if (fs.existsSync(DEV_DATA_FILE)) {
        const data = fs.readFileSync(DEV_DATA_FILE, "utf-8");
        const parsed = JSON.parse(data);
        const voteData = parsed["poll:votes"] || { A: 0, B: 0 };
        return voteData;
      }
    } catch (error) {
      console.error("Failed to read dev data file:", error);
    }
    // 파일이 없으면 메모리에서 읽기
    const data = devStore.get("poll:votes");
    const result = data || { A: 0, B: 0 };
    return result;
  }
  
  // Vercel KV에서는 A와 B를 따로 저장하므로 따로 조회
  const A = (await kv.get<number>("poll:votes:A")) || 0;
  const B = (await kv.get<number>("poll:votes:B")) || 0;
  const result = { A, B };
  return result;
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
    saveDevData();
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
    saveDevData();
    return;
  }
  await kv.set("poll:votes:A", 0);
  await kv.set("poll:votes:B", 0);
}

// 투표 초기화 및 사용자 투표 기록 무효화 (버전 네임스페이스 증가)
export async function resetVotesAndInvalidateUsers(pollId: string): Promise<void> {
  // 투표 수 초기화
  await resetVotes();
  
  // 버전 네임스페이스 증가 (기존 사용자 투표 기록 무효화)
  await incrementVersion();
  
  console.log(`Votes reset and user records invalidated for poll: ${pollId}, new version: ${await getCurrentVersion()}`);
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
    saveDevData();
    return;
  }
  await kv.set("poll:tomorrow", data);
}

// 내일 poll 삭제
export async function deleteTomorrowPoll(): Promise<void> {
  if (isDev) {
    devStore.delete("poll:tomorrow");
    saveDevData();
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
    saveDevData();
    return;
  }
  await kv.set("poll:last_update", date);
}

// 한국 시간(KST) 기준 날짜 가져오기
function getKSTDate(): string {
  const now = new Date();
  return now.toLocaleDateString("ko-KR", { 
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit", 
    day: "2-digit"
  }).replace(/\./g, "").replace(/\s/g, "-"); // YYYY-MM-DD 형식
}

function getTodayDate(): string {
  return getKSTDate();
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
    if (!poll) return false; // 설문이 없으면 저장 안 함
    const item: PollHistoryItem = { date: dateKey, poll, votes };
    devStore.set(historyKey, item);
    saveDevData();
    return true;
  }

  const exists = await kv.exists(historyKey);
  if (exists) return false;
  const poll = await getPollData();
  const votes = await getVoteData();
  if (!poll) return false; // 설문이 없으면 저장 안 함
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

// 모든 히스토리 불러오기
export async function getPollHistory(): Promise<PollHistoryItem[]> {
  const allHistory: PollHistoryItem[] = [];
  
  if (isDev) {
    // 개발 환경: devStore에서 모든 poll:history:* 키 찾기
    devStore.forEach((value, key) => {
      if (key.startsWith("poll:history:")) {
        allHistory.push(value as PollHistoryItem);
      }
    });
  } else {
    // 프로덕션: Vercel KV에서 모든 히스토리 조회
    // Vercel KV는 패턴 검색을 지원하지 않으므로, 최근 일주일만 조회
    const promises = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const historyKey = `poll:history:${dateStr}`;
      promises.push(kv.get<PollHistoryItem>(historyKey));
    }
    
    const results = await Promise.all(promises);
    results.forEach(history => {
      if (history) {
        allHistory.push(history);
      }
    });
  }
  
  return allHistory;
}

// 자정에 자동으로 내일 poll을 오늘 poll로 전환
export async function checkAndPromoteTomorrowPoll(): Promise<boolean> {
  const today = getKSTDate(); // 한국 시간 기준
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
    // 새로운 Poll ID 생성 (날짜 기반 + 랜덤)
    const randomSuffix = crypto.randomBytes(4).toString("hex");
    const newPollId = `poll-${today}-${randomSuffix}`;
    
    const promotedPoll = {
      ...tomorrowPoll,
      id: newPollId
    };
    
    await setPollData(promotedPoll);
    await deleteTomorrowPoll();
    await resetVotesAndInvalidateUsers(newPollId);
    await setLastUpdateDate(today);
    return true;
  }

  // 내일 poll이 없으면 오늘 poll 삭제 (빈 화면으로)
  await deletePollData();
  await resetVotes(); // 투표도 초기화
  await setLastUpdateDate(today);
  return false;
}

// ========== 사용자 중복 투표 방지 (UUID + Poll ID + Version 기반) ==========

// 현재 버전 네임스페이스 가져오기
async function getCurrentVersion(): Promise<number> {
  const key = "poll:version";
  
  if (isDev) {
    return devStore.get(key) || 0;
  }
  
  const version = await kv.get<number>(key);
  return version || 0;
}

// 버전 네임스페이스 증가
async function incrementVersion(): Promise<number> {
  const key = "poll:version";
  const currentVersion = await getCurrentVersion();
  const newVersion = currentVersion + 1;
  
  if (isDev) {
    devStore.set(key, newVersion);
    saveDevData();
  } else {
    await kv.set(key, newVersion);
  }
  
  return newVersion;
}

// 사용자가 특정 poll에 이미 투표했는지 확인 (버전 기반)
export async function checkUserVoted(userId: string, pollId: string): Promise<UserVoteRecord | null> {
  const currentVersion = await getCurrentVersion();
  const key = `vote:${currentVersion}:user:${userId}:poll:${pollId}`;
  
  if (isDev) {
    const record = devStore.get(key) as UserVoteRecord | undefined;
    return record || null;
  }
  
  const record = await kv.get<UserVoteRecord>(key);
  return record || null;
}

// 사용자 투표 기록 저장 (poll 단위, 버전 기반)
export async function recordUserVote(userId: string, pollId: string, choice: "A" | "B"): Promise<void> {
  const currentVersion = await getCurrentVersion();
  const key = `vote:${currentVersion}:user:${userId}:poll:${pollId}`;
  const record: UserVoteRecord = {
    pollId,
    choice,
    timestamp: Date.now(),
  };
  
  if (isDev) {
    devStore.set(key, record);
    saveDevData();
    return;
  }
  
  // KV에 저장
  await kv.set(key, record);
}

// ========== 히스토리 관리 ==========

// 히스토리 삭제
export async function deleteHistory(date: string): Promise<boolean> {
  const historyKey = `poll:history:${date}`;
  
  if (isDev) {
    const exists = devStore.has(historyKey);
    if (exists) {
      devStore.delete(historyKey);
      saveDevData();
      return true;
    }
    return false;
  }
  
  const exists = await kv.exists(historyKey);
  if (exists) {
    await kv.del(historyKey);
    return true;
  }
  return false;
}

// 히스토리 수정
export async function updateHistory(date: string, votes: { A: number; B: number }): Promise<boolean> {
  const historyKey = `poll:history:${date}`;
  
  if (isDev) {
    const existingHistory = devStore.get(historyKey);
    if (!existingHistory) return false;
    
    const updatedHistory = {
      ...existingHistory,
      votes: votes
    };
    
    devStore.set(historyKey, updatedHistory);
    saveDevData();
    return true;
  }
  
  const existingHistory = await kv.get(historyKey);
  if (!existingHistory) return false;
  
  const updatedHistory = {
    ...existingHistory,
    votes: votes
  };
  
  await kv.set(historyKey, updatedHistory);
  return true;
}

// ========== 테스트 전용 ==========


