// app/history/page.tsx (서버 컴포넌트)
export const revalidate = 60;               // 60초마다 ISR
export const dynamic = "force-static";      // 가능하면 정적으로

import { fetchHistoryPage } from "@/lib/data"; // DB 직접 쿼리(서버에서)
import HistoryClient from "./HistoryClient";   // 클라 무한스크롤 담당
import HistoryListSSR from "./HistoryListSSR"; // SSR로 렌더링되는 히스토리 리스트
import Header from "./Header";                 // 히스토리 페이지 헤더

export default async function HistoryPage() {
  const { items, nextCursor } = await fetchHistoryPage({ limit: 10 }); // 오늘 제외 + 최신순

  return (
    <div className="flex flex-col items-center min-h-dvh px-4 pb-4 sm:px-6 sm:pb-6" style={{ marginLeft: 20, marginRight: 20, marginTop: '30px' }}>
      <div className="w-full max-w-4xl flex flex-col items-center justify-center min-h-screen">
        {/* 헤더/상단 즉시 렌더 */}
        <Header itemsCountHint={items.length} />
        
        {/* 히스토리 목록 */}
        <div className="w-full max-w-3xl space-y-6">
          {/* 초기 1페이지는 SSR로 이미 DOM */}
          <HistoryListSSR items={items} />
          {/* 이후 페이지는 클라에서 무한스크롤로 이어붙임 */}
          <HistoryClient initialCursor={nextCursor} />
        </div>
      </div>
    </div>
  );
}
