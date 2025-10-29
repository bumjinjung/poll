import PollClient from "./components/PollClient";
import { getPollData, getVoteData, checkAndPromoteTomorrowPoll } from "@/lib/kv";

// 완전 비캐시 처리
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default async function Home() {
  await checkAndPromoteTomorrowPoll();
  const initialConfig = await getPollData();
  const initialVotes = await getVoteData();
  
  return (
    <PollClient 
      key={initialConfig?.id || 'no-poll'}
      initialConfig={initialConfig} 
      initialVotes={initialVotes}
    />
  );
}
