"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type PollData = {
  question: string;
  left: { label: string; emoji: string };
  right: { label: string; emoji: string };
};

type VoteData = {
  A: number;
  B: number;
};

type PollHistoryItem = {
  date: string;
  poll: PollData | null;
  votes: VoteData;
};

const PAGE_SIZE = 10; // 한 번에 추가로 렌더할 개수

export default function HistoryPage() {
  const [allHistory, setAllHistory] = useState<PollHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 현재 화면에 보여줄 개수 (처음 10개)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isPaging, setIsPaging] = useState(false); // 추가 로딩 중 표시
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // 오늘 제외 + 최신순 정렬
          const now = new Date();
          const kstOffset = 9 * 60;
          const kstTime = new Date(now.getTime() + kstOffset * 60 * 1000);
          const today = kstTime.toISOString().split("T")[0];

          const filtered = (data.history as PollHistoryItem[])
            .filter((item) => item.date !== today)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          setAllHistory(filtered);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // 인터섹션 옵저버: sentinel이 보이면 다음 PAGE_SIZE만큼 더 보여주기
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (loading) return;
    if (allHistory.length <= PAGE_SIZE) return; // 전체가 10개 이하면 무한스크롤 불필요

    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          // 추가 로딩 표시
          setIsPaging(true);
          // 살짝 디바운스 느낌 주기 (UI 자연스럽게)
          setTimeout(() => {
            setVisibleCount((prev) => {
              const next = Math.min(prev + PAGE_SIZE, allHistory.length);
              return next;
            });
            setIsPaging(false);
          }, 150);
        }
      },
      {
        root: null, // window 스크롤 기준
        rootMargin: "200px 0px", // 바닥 200px 전에 미리 로드
        threshold: 0.01,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, allHistory.length]);

  // 렌더할 조각
  const itemsToRender = allHistory.slice(0, visibleCount);
  const hasMore = visibleCount < allHistory.length;

  return (
    <div className="flex flex-col items-center min-h-dvh px-4 pb-4 sm:px-6 sm:pb-6" style={{ marginLeft: 20, marginRight: 20, marginTop: '30px' }}>
      <div className="w-full max-w-4xl flex flex-col items-center justify-center min-h-screen">
        {/* 헤더 */}
        <div className="w-full flex items-center justify-between mb-8 mt-8" style={{ marginBottom: '5px' }}>
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <span>←</span>
            <span>홈으로</span>
          </Link>
          <div className="text-center flex-1 hidden sm:block">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">히스토리</h1>
            <p className="text-sm text-gray-500 mt-1">{allHistory.length}개의 설문</p>
          </div>
          <div className="w-16"></div>
        </div>

        {/* 히스토리 목록 */}
        <div className="w-full max-w-3xl space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400 text-sm">로딩 중...</div>
          </div>
        ) : allHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-gray-400 text-lg mb-2">아직 히스토리가 없습니다</p>
            <p className="text-gray-400 text-sm">설문이 진행되면 여기에 표시됩니다</p>
          </div>
        ) : (
          <>
            <div className="space-y-12">
              {itemsToRender.map((item, index) => {
              const poll = item.poll;
              if (!poll) return null;

              const totalVotes = item.votes.A + item.votes.B;
              const percentA = totalVotes > 0 ? Math.round((item.votes.A / totalVotes) * 100) : 50;
              const percentB = totalVotes > 0 ? Math.round((item.votes.B / totalVotes) * 100) : 50;
              // 히스토리 데이터에서 날짜 추출
              const dateStr = item.date || "2025-10-22"; // fallback
              const formattedDate = new Date(dateStr).toLocaleDateString("ko-KR", {
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={`${item.date}-${index}`}
                  className="w-full"
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
                  }}
                >
                  {/* 질문 & 날짜 */}
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{poll.question}</h3>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{formattedDate}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{totalVotes.toLocaleString()}명 참여</span>
                    </div>
                  </div>

                  {/* 투표 결과 */}
                  <div>
                    {/* Option A */}
                    <div className="relative" style={{ marginBottom: '5px' }}>
                      <div className="relative h-6 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full bar-animation"
                          style={{ 
                            '--target-width': `${percentA}%`,
                            animationDelay: `${index * 0.1 + 0.3}s`
                          } as React.CSSProperties}
                        />
                        <div className="absolute inset-0 flex items-center justify-between" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
                          <span className="text-xs text-white font-medium">
                            {poll.left.emoji} {poll.left.label}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            {item.votes.A.toLocaleString()}표
                          </span>
                        </div>
                        <span 
                          className="text-sm font-bold text-gray-800 opacity-0 absolute"
                          style={{
                            animation: `fadeIn 0.3s ease-out ${index * 0.1 + 1.3}s forwards`,
                            left: `${percentA}%`,
                            top: '50%',
                            transform: 'translateY(-50%) translateX(4px)'
                          }}
                        >
                          {percentA}%
                        </span>
                      </div>
                    </div>

                    {/* Option B */}
                    <div className="relative" style={{ marginBottom: '20px' }}>
                      <div className="relative h-6 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full bar-animation"
                          style={{ 
                            '--target-width': `${percentB}%`,
                            animationDelay: `${index * 0.1 + 0.5}s`
                          } as React.CSSProperties}
                        />
                        <div className="absolute inset-0 flex items-center justify-between" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
                          <span className="text-xs text-white font-medium">
                            {poll.right.emoji} {poll.right.label}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            {item.votes.B.toLocaleString()}표
                          </span>
                        </div>
                        <span 
                          className="text-sm font-bold text-gray-800 opacity-0 absolute"
                          style={{
                            animation: `fadeIn 0.3s ease-out ${index * 0.1 + 1.5}s forwards`,
                            left: `${percentB}%`,
                            top: '50%',
                            transform: 'translateY(-50%) translateX(4px)'
                          }}
                        >
                          {percentB}%
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              );
              })}
            </div>

            {/* sentinel: 바닥에 닿으면 다음 10개 로드 */}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-6">
                <span className="text-xs text-gray-400">
                  {isPaging ? "불러오는 중..." : "아래로 스크롤하면 더 보기"}
                </span>
              </div>
            )}
          </>
        )}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* 웹킷 브라우저용 스크롤바 스타일 */
        .scrollbar-custom::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-custom::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        /* 바 차트 애니메이션 */
        @keyframes growBar {
          from {
            width: 0%;
          }
          to {
            width: var(--target-width);
          }
        }
        
        .bar-animation {
          animation: growBar 1s ease-out forwards;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
