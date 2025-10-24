import { NextResponse } from "next/server";
import { updateHistory } from "@/lib/kv";

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
    
    const success = await updateHistory(date, votes);
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: `히스토리 ${date}가 성공적으로 수정되었습니다.`,
        votes
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "해당 날짜의 히스토리를 찾을 수 없습니다." 
      });
    }
    
  } catch (error) {
    console.error("Fix history error:", error);
    return NextResponse.json(
      { success: false, message: "히스토리 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
