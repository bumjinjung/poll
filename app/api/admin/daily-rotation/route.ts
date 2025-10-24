import { NextResponse } from "next/server";
import { checkAndPromoteTomorrowPoll } from "@/lib/kv";

export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("Daily rotation cron job started");
    
    // 자정에 자동으로 히스토리 저장 및 설문 전환
    const promoted = await checkAndPromoteTomorrowPoll();
    
    if (promoted) {
      console.log("Tomorrow poll promoted to today");
      return NextResponse.json({ 
        success: true, 
        message: "설문이 성공적으로 전환되었습니다.",
        promoted: true
      });
    } else {
      console.log("No tomorrow poll to promote");
      return NextResponse.json({ 
        success: true, 
        message: "전환할 내일 설문이 없습니다.",
        promoted: false
      });
    }
  } catch (error) {
    console.error("Daily rotation error:", error);
    return NextResponse.json(
      { success: false, message: "자동 전환 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
