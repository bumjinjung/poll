import { NextResponse } from "next/server";
import { getPollHistory } from "@/lib/kv";

export async function GET() {
  try {
    const history = await getPollHistory();
    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("Get history error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to get history" },
      { status: 500 }
    );
  }
}

