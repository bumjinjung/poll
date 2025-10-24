import { NextResponse } from "next/server";
import { getPollData, setPollData, getTomorrowPoll, setTomorrowPoll, resetVotes } from "@/lib/kv";
import { generatePollWithChatGPT } from "@/lib/chatgpt";

function getFallbackTemplate() {
  const fallbackTemplates = [
    {
      question: "오늘 점심 뭐 드실래요?",
      left: { label: "한식", emoji: "🍚" },
      right: { label: "양식", emoji: "🍝" }
    },
    {
      question: "오늘 저녁 계획은?",
      left: { label: "집에서 휴식", emoji: "🏠" },
      right: { label: "밖에서 활동", emoji: "🌃" }
    },
    {
      question: "오늘 기분은 어떠세요?",
      left: { label: "좋아요", emoji: "😊" },
      right: { label: "보통이에요", emoji: "😐" }
    },
    {
      question: "오늘 운동할까요?",
      left: { label: "네, 할게요", emoji: "💪" },
      right: { label: "내일 할게요", emoji: "😴" }
    },
    {
      question: "오늘 뭐 드실래요?",
      left: { label: "치킨", emoji: "🍗" },
      right: { label: "피자", emoji: "🍕" }
    }
  ];

  const randomIndex = Math.floor(Math.random() * fallbackTemplates.length);
  return fallbackTemplates[randomIndex];
}

export const runtime = "nodejs";

// 자동 설문 생성
export async function POST(req: Request) {
  try {
    const { type = "today" } = await req.json();
    
    if (type === "today") {
      // 오늘 설문 생성
      const existingPoll = await getPollData();
      if (existingPoll) {
        return NextResponse.json({ 
          success: false, 
          message: "오늘 설문이 이미 존재합니다." 
        });
      }

      const result = await generatePollWithChatGPT();
      
      if (!result.success) {
        // ChatGPT 실패 시 기본 템플릿으로 생성
        const fallbackPoll = getFallbackTemplate();
        await setPollData(fallbackPoll);
        await resetVotes();
        
        return NextResponse.json({ 
          success: true, 
          message: `ChatGPT 자동 생성 실패. 기본 템플릿으로 생성되었습니다. (오류: ${result.error})`,
          poll: fallbackPoll,
          isFallback: true,
          error: result.error
        });
      }

      await setPollData(result.poll!);
      await resetVotes();

      return NextResponse.json({ 
        success: true, 
        message: "ChatGPT로 오늘 설문이 생성되었습니다.",
        poll: result.poll,
        isFallback: false
      });
    }
    
    if (type === "tomorrow") {
      // 내일 설문 생성
      const existingTomorrowPoll = await getTomorrowPoll();
      if (existingTomorrowPoll) {
        return NextResponse.json({ 
          success: false, 
          message: "내일 설문이 이미 존재합니다." 
        });
      }

      const result = await generatePollWithChatGPT();
      
      if (!result.success) {
        // ChatGPT 실패 시 기본 템플릿으로 생성
        const fallbackPoll = getFallbackTemplate();
        await setTomorrowPoll(fallbackPoll);
        
        return NextResponse.json({ 
          success: true, 
          message: `ChatGPT 자동 생성 실패. 기본 템플릿으로 생성되었습니다. (오류: ${result.error})`,
          poll: fallbackPoll,
          isFallback: true,
          error: result.error
        });
      }

      await setTomorrowPoll(result.poll!);

      return NextResponse.json({ 
        success: true, 
        message: "ChatGPT로 내일 설문이 생성되었습니다.",
        poll: result.poll,
        isFallback: false
      });
    }

    return NextResponse.json({ 
      success: false, 
      message: "잘못된 요청입니다." 
    });

  } catch (error) {
    console.error("자동 생성 오류:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "자동 생성에 실패했습니다.",
        error: error instanceof Error ? error.message : "알 수 없는 오류"
      },
      { status: 500 }
    );
  }
}

// 현재 상태 확인
export async function GET() {
  try {
    const todayPoll = await getPollData();
    const tomorrowPoll = await getTomorrowPoll();

    return NextResponse.json({
      success: true,
      today: todayPoll ? "존재" : "없음",
      tomorrow: tomorrowPoll ? "존재" : "없음",
      todayPoll,
      tomorrowPoll
    });
  } catch (error) {
    console.error("상태 확인 오류:", error);
    return NextResponse.json(
      { success: false, message: "상태 확인에 실패했습니다." },
      { status: 500 }
    );
  }
}
