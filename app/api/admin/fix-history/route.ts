import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { date, votes } = await req.json();
    
    if (!date || !votes) {
      return NextResponse.json({ 
        success: false, 
        message: "날짜와 투표 데이터가 필요합니다." 
      });
    }
    
    // 히스토리 키 생성
    const historyKey = `poll:history:${date}`;
    
    // 기존 히스토리 데이터 가져오기
    const existingHistory = await kv.get(historyKey);
    
    if (!existingHistory) {
      return NextResponse.json({ 
        success: false, 
        message: "해당 날짜의 히스토리를 찾을 수 없습니다." 
      });
    }
    
    // 투표 데이터만 업데이트
    const updatedHistory = {
      ...existingHistory,
      votes: votes
    };
    
    // 업데이트된 히스토리 저장
    await kv.set(historyKey, updatedHistory);
    
    return NextResponse.json({ 
      success: true, 
      message: `히스토리 ${date}가 성공적으로 수정되었습니다.`,
      updatedHistory
    });
    
  } catch (error) {
    console.error("Fix history error:", error);
    return NextResponse.json(
      { success: false, message: "히스토리 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
