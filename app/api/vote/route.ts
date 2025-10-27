import { NextResponse } from "next/server";
import { addVote, getVoteData, getPollData, checkUserVoted, recordUserVote } from "@/lib/kv";
import { cookies } from "next/headers";
import crypto from "crypto";

// 캐시 완전 비활성화
export const dynamic = "force-dynamic";
export const revalidate = 0;

const USER_ID_COOKIE = "poll_user_id";

// UUID v4 생성
function generateUUID(): string {
  return crypto.randomUUID();
}

// 쿠키에서 사용자 ID 가져오거나 생성
async function getUserId(): Promise<string> {
  const cookieStore = await cookies();
  let userId = cookieStore.get(USER_ID_COOKIE)?.value;
  
  if (!userId) {
    userId = generateUUID();
  }
  
  return userId;
}

// 투표하기
export async function POST(req: Request) {
  try {
    // Content-Type 확인
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, message: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    // body가 비어있는지 확인
    const text = await req.text();
    if (!text || text.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Request body is empty" },
        { status: 400 }
      );
    }

    let choice: string;
    try {
      const body = JSON.parse(text);
      choice = body.choice;
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Body:", text);
      return NextResponse.json(
        { success: false, message: "Invalid JSON format" },
        { status: 400 }
      );
    }

    if (choice !== "A" && choice !== "B") {
      return NextResponse.json(
        { success: false, message: "Invalid choice" },
        { status: 400 }
      );
    }

    // 사용자 ID 가져오기
    const userId = await getUserId();

    // 현재 설문 가져오기
    const currentPoll = await getPollData();
    if (!currentPoll) {
      return NextResponse.json(
        { success: false, message: "설문조사가 준비되지 않았습니다" },
        { status: 404 }
      );
    }

    // 이미 투표했는지 확인 (poll ID 기반)
    const userVote = await checkUserVoted(userId, currentPoll.id);
    if (userVote) {
      return NextResponse.json(
        { success: false, message: "이미 투표하셨습니다" },
        { status: 403 }
      );
    }

    // 투표 처리
    const votes = await addVote(choice);

    // 사용자 투표 기록 (poll ID 기반)
    await recordUserVote(userId, currentPoll.id, choice);

    const response = NextResponse.json({ success: true, votes });
    
    // 쿠키 설정 (1년 유지)
    const cookieStore = await cookies();
    cookieStore.set(USER_ID_COOKIE, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1년
    });
    
    // 캐시 방지 헤더 설정
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
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
    
    // 현재 설문 가져오기
    const currentPoll = await getPollData();
    if (!currentPoll) {
      const response = NextResponse.json({ success: true, votes, userVote: null });
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }
    
    // 사용자 ID 가져오기
    const userId = await getUserId();
    
    // 사용자가 이미 투표했는지 확인 (poll ID 기반)
    const userVote = await checkUserVoted(userId, currentPoll.id);
    
    const response = NextResponse.json({ 
      success: true, 
      votes, 
      userVote: userVote ? userVote.choice : null 
    });
    
    // 쿠키 설정 (조회 시에도 쿠키가 없으면 생성)
    const cookieStore = await cookies();
    if (!cookieStore.get(USER_ID_COOKIE)) {
      cookieStore.set(USER_ID_COOKIE, userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1년
      });
    }
    
    // 캐시 방지 헤더 설정
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error("Get votes error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to get votes" },
      { status: 500 }
    );
  }
}

