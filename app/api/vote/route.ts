import { NextResponse } from "next/server";
import { addVote, getVoteData, getPollData, checkUserVoted, recordUserVote } from "@/lib/kv";
import { headers } from "next/headers";
import crypto from "crypto";

// IP + UA로 고유 해시 생성
function getUserHash(ip: string, ua: string): string {
  return crypto.createHash("sha256").update(`${ip}:${ua}`).digest("hex");
}

// 투표하기
export async function POST(req: Request) {
  try {
    const { choice } = await req.json();

    if (choice !== "A" && choice !== "B") {
      return NextResponse.json(
        { success: false, message: "Invalid choice" },
        { status: 400 }
      );
    }

    // IP와 User-Agent 가져오기
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] || 
               headersList.get("x-real-ip") || 
               "unknown";
    const ua = headersList.get("user-agent") || "unknown";
    const userHash = getUserHash(ip, ua);

    // 현재 질문 가져오기
    const currentPoll = await getPollData();
    if (!currentPoll) {
      return NextResponse.json(
        { success: false, message: "설문조사가 준비되지 않았습니다" },
        { status: 404 }
      );
    }
    const currentQuestion = currentPoll.question;

    // 이미 투표했는지 확인
    const userVote = await checkUserVoted(userHash, currentQuestion);
    if (userVote) {
      return NextResponse.json(
        { success: false, message: "이미 투표하셨습니다" },
        { status: 403 }
      );
    }

    // 투표 처리
    const votes = await addVote(choice);

    // 사용자 투표 기록
    await recordUserVote(userHash, currentQuestion, choice);

    return NextResponse.json({ success: true, votes });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to vote" },
      { status: 500 }
    );
  }
}

// 투표 결과 조회
export async function GET() {
  try {
    const votes = await getVoteData();
    
    // 현재 질문 가져오기
    const currentPoll = await getPollData();
    if (!currentPoll) {
      return NextResponse.json({ success: true, votes, userVote: null });
    }
    
    // IP와 User-Agent 가져오기
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] || 
               headersList.get("x-real-ip") || 
               "unknown";
    const ua = headersList.get("user-agent") || "unknown";
    const userHash = getUserHash(ip, ua);
    
    // 사용자가 이미 투표했는지 확인하고 투표 정보 반환
    const userVote = await checkUserVoted(userHash, currentPoll.question);
    
    return NextResponse.json({ 
      success: true, 
      votes, 
      userVote: userVote ? userVote.choice : null 
    });
  } catch (error) {
    console.error("Get votes error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to get votes" },
      { status: 500 }
    );
  }
}

