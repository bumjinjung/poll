import PollClient from "./components/PollClient";
import { getPollData, getVoteData, checkAndPromoteTomorrowPoll, checkUserVoted } from "@/lib/kv";
import { cookies } from "next/headers";

// 완전 비캐시 처리
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default async function Home() {
  await checkAndPromoteTomorrowPoll();
  const initialConfig = await getPollData();
  const initialVotes = await getVoteData();
  
  // 서버에서 사용자 투표 여부 확인
  let initialUserVote: "A" | "B" | null = null;
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("poll_user_id")?.value;
    
    if (userId && initialConfig) {
      const userVoteRecord = await checkUserVoted(userId, initialConfig.id);
      if (userVoteRecord) {
        initialUserVote = userVoteRecord.choice as "A" | "B";
      }
    }
  } catch (error) {
    console.error("Failed to check user vote:", error);
  }
  
  return (
    <PollClient 
      initialConfig={initialConfig} 
      initialVotes={initialVotes}
      initialUserVote={initialUserVote}
    />
  );
}
