import { NextResponse } from "next/server";
import { addVote, getVoteData } from "@/lib/kv";

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

    const votes = await addVote(choice);

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
    return NextResponse.json({ success: true, votes });
  } catch (error) {
    console.error("Get votes error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to get votes" },
      { status: 500 }
    );
  }
}

