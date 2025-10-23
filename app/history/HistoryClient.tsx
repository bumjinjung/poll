"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PollHistoryItem } from "@/lib/data";
import HistoryItem from "./HistoryItem";

type HistoryClientProps = {
  initialCursor: string | null;
};

export default function HistoryClient({ initialCursor }: HistoryClientProps) {
  const [items, setItems] = useState<PollHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !nextCursor) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/history?cursor=${encodeURIComponent(nextCursor)}&limit=10`, { cache: "force-cache" });
      const data = await res.json();
      if (data.success) {
        setItems(prev => [...prev, ...data.items]);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (e) {
      console.error("Error loading more history:", e);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, nextCursor]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading) loadMore();
    }, { root: null, rootMargin: "200px 0px", threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadMore]);

  // 초기 데이터가 없으면 첫 번째 페이지 로드
  useEffect(() => {
    if (initialCursor && items.length === 0) {
      loadMore();
    }
  }, [initialCursor, loadMore, items.length]);

  if (!hasMore && items.length === 0) {
    return null; // 초기 데이터가 SSR로 이미 렌더링되었으므로
  }

  return (
    <>
      {/* 추가 로드된 히스토리 아이템들 */}
      {items.map((item, index) => (
        <HistoryItem 
          key={`${item.date}-${index}`} 
          item={item} 
          index={index} 
        />
      ))}

      {/* 무한스크롤 센티넬 */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-6">
          <span className="text-xs text-gray-400">
            {loading ? "불러오는 중..." : "아래로 스크롤하면 더 보기"}
          </span>
        </div>
      )}
    </>
  );
}
