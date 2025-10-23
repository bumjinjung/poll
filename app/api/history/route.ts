// app/api/history/route.ts (Node.js Runtime + 캐시 헤더)
export const runtime = "nodejs"; // Node.js Runtime 사용

import { NextResponse } from "next/server";
import { fetchHistoryPage } from "@/lib/data";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = Number(searchParams.get("limit") ?? 20);

    const data = await fetchHistoryPage({ cursor, limit });

    const res = NextResponse.json({
      success: true,
      items: data.items,
      nextCursor: data.nextCursor,
      hasMore: data.hasMore
    });
    
    // CDN 캐시 (1분), 느슨하게 재검증
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    return res;
  } catch (error) {
    console.error("Get history error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to get history" },
      { status: 500 }
    );
  }
}

