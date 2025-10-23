import { NextRequest, NextResponse } from "next/server";
import { 
  getPollData, 
  setPollData, 
  getVoteData, 
  resetVotes,
  getTomorrowPoll,
  setTomorrowPoll,
  deleteTomorrowPoll,
  checkAndPromoteTomorrowPoll
} from "@/lib/kv";

const ADMIN_KEY = process.env.ADMIN_KEY || "dev-admin"; // 간단한 개발용 키

// 설문 질문 + 투표 결과 + 내일 poll 조회
export async function GET() {
  try {
    // 날짜 체크하여 자동 전환
    await checkAndPromoteTomorrowPoll();

    const pollData = await getPollData();
    const voteData = await getVoteData();
    const tomorrowData = await getTomorrowPoll();
    
    return NextResponse.json({ 
      success: true, 
      data: pollData,
      votes: voteData,
      tomorrow: tomorrowData
    });
  } catch (e) {
    console.error("GET poll error:", e);
    return NextResponse.json(
      { success: false, message: "설정을 읽지 못했습니다." },
      { status: 500 }
    );
  }
}

// 설문 질문 업데이트 (관리자 전용)
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || "";
  
  // 디버깅용 (배포 환경 확인)
  console.log("🔑 Received:", key.substring(0, 3) + "...");
  console.log("🔑 Expected:", ADMIN_KEY.substring(0, 3) + "...");
  console.log("🔑 Match:", key === ADMIN_KEY);
  
  if (key !== ADMIN_KEY) {
    return NextResponse.json(
      { success: false, message: `권한이 없습니다. (received: ${key.substring(0, 3)}..., expected: ${ADMIN_KEY.substring(0, 3)}...)` },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { question, left, right, resetVotesFlag, isToday, isTomorrow, deleteTomorrow } = body || {};

    // 내일 poll 삭제 요청
    if (deleteTomorrow) {
      await deleteTomorrowPoll();
      return NextResponse.json({ success: true, message: "내일 poll이 삭제되었습니다." });
    }

    if (
      typeof question !== "string" ||
      !left || typeof left.label !== "string" ||
      !right || typeof right.label !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 입력입니다." },
        { status: 400 }
      );
    }

    const payload = {
      question: question.trim(),
      left: { label: left.label.trim(), emoji: left.emoji || "" },
      right: { label: right.label.trim(), emoji: right.emoji || "" },
    };

    // 내일 poll 저장
    if (isTomorrow) {
      await setTomorrowPoll(payload);
      return NextResponse.json({ success: true, data: payload, message: "내일 poll이 저장되었습니다." });
    }

    // 오늘 poll 저장 (기본)
    await setPollData(payload);

    // 새 질문 등록시 투표 초기화
    if (resetVotesFlag) {
      await resetVotes();
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (e) {
    console.error("POST poll error:", e);
    return NextResponse.json(
      { success: false, message: "설정을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
