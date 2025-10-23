import PollClient from "./components/PollClient";
import { getPollData, getVoteData, checkAndPromoteTomorrowPoll } from "@/lib/kv";

export const revalidate = 0; // 캐시 비활성화

export default async function Home() {
  await checkAndPromoteTomorrowPoll();
  const initialConfig = await getPollData();
  const initialVotes = await getVoteData();
  return <PollClient initialConfig={initialConfig} initialVotes={initialVotes} />;
}
