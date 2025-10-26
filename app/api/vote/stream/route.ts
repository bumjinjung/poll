import { NextRequest } from "next/server";

// SSE 클라이언트 관리
const clients = new Set<ReadableStreamDefaultController>();

// SSE 브로드캐스트 함수
export function broadcastSSE(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encodedMessage = encoder.encode(message);
  
  clients.forEach(controller => {
    try {
      controller.enqueue(encodedMessage);
    } catch (error) {
      // 연결이 끊어진 클라이언트 제거
      clients.delete(controller);
    }
  });
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // 클라이언트 등록
      clients.add(controller);
      
      // SSE 헤더 설정
      controller.enqueue(encoder.encode("data: " + JSON.stringify({ type: "connected" }) + "\n\n"));
      
      // 클라이언트 연결 해제 시 정리
      request.signal.addEventListener("abort", () => {
        clients.delete(controller);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}
