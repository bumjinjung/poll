import { NextResponse } from "next/server";
import { getPollData, getVoteData, saveHistorySnapshot } from "@/lib/kv";

export const runtime = "nodejs";

export async function POST() {
  try {
    console.log("Manual history creation started");
    
    // 현재 투표 데이터 가져오기
    const poll = await getPollData();
    const votes = await getVoteData();
    
    if (!poll) {
      return NextResponse.json({ 
        success: false, 
        message: "현재 설문이 없습니다." 
      });
    }
    
    console.log("Current poll:", poll);
    console.log("Current votes:", votes);
    
    // 히스토리 저장 (오늘 날짜로)
    const saved = await saveHistorySnapshot();
    
    if (saved) {
      return NextResponse.json({ 
        success: true, 
        message: "히스토리가 성공적으로 저장되었습니다.",
        poll,
        votes
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "히스토리 저장에 실패했습니다. (이미 존재할 수 있음)" 
      });
    }
  } catch (error) {
    console.error("Manual history creation error:", error);
    return NextResponse.json(
      { success: false, message: "히스토리 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
