import { NextRequest, NextResponse } from "next/server";
import { getPollData, setPollData, getVoteData, resetVotes } from "@/lib/kv";

const ADMIN_KEY = process.env.ADMIN_KEY || "dev-admin"; // 간단한 개발용 키

// 설문 질문 + 투표 결과 조회
export async function GET() {
  try {
    const pollData = await getPollData();
    const voteData = await getVoteData();
    return NextResponse.json({ 
      success: true, 
      data: pollData,
      votes: voteData
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
  if (key !== ADMIN_KEY) {
    return NextResponse.json(
      { success: false, message: "권한이 없습니다." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { question, left, right, resetVotesFlag } = body || {};

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
