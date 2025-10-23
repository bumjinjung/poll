import { getTodaysPoll } from "@/app/data/polls";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const todaysPoll = getTodaysPoll();
    return NextResponse.json({
      success: true,
      data: todaysPoll,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "설문조사를 가져오는데 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

