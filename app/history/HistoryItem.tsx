"use client";
import { useEffect, useRef, useState } from "react";
import type { PollHistoryItem } from "@/lib/data";

export default function HistoryItem({
  item,
  index,
}: {
  item: PollHistoryItem;
  index: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return;
    const el = hostRef.current;
    
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.unobserve(el); // 한 번만
        }
      },
      { root: null, threshold: 0.1, rootMargin: "100px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const poll = item.poll;
  if (!poll) return null;

  const total = item.votes.A + item.votes.B;
  const percentA = total > 0 ? Math.round((item.votes.A / total) * 100) : 0;
  const percentB = total > 0 ? Math.round((item.votes.B / total) * 100) : 0;
  
  const dateStr = item.date || "2025-10-22";
  const formattedDate = new Date(dateStr).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={hostRef}
      className={`
        w-full transition-all duration-500 ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
      `}
      style={{
        // 약간의 스태거 효과
        transitionDelay: visible ? `${(index % 10) * 40}ms` : "0ms",
      }}
    >
      {/* 질문 & 날짜 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{poll.question}</h3>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{formattedDate}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{total.toLocaleString()}명 참여</span>
        </div>
      </div>

      {/* 투표 결과 */}
      <div>
        {/* Option A */}
        <div className="relative" style={{ marginBottom: '5px' }}>
          <div className="relative h-8 rounded-full overflow-hidden bg-gray-200">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"
              style={{
                width: visible ? `${percentA}%` : '0%',
                transition: "width 600ms ease-out",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-between" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
              <span className={`text-xs font-medium ${percentA > 0 ? 'text-white' : 'text-gray-800'}`}>
                {poll.left.emoji} {poll.left.label}
              </span>
              <span className={`text-xs font-medium ${percentA > 0 ? 'text-gray-500' : 'text-gray-700'}`}>
                {item.votes.A.toLocaleString()}표
              </span>
            </div>
            {percentA > 0 && (
              <span 
                className="text-sm font-bold text-gray-800 absolute"
                style={{
                  opacity: visible ? 1 : 0,
                  left: `${percentA}%`,
                  top: '50%',
                  transform: 'translateY(-50%) translateX(4px)',
                  transition: 'opacity 0.3s ease-out',
                  transitionDelay: visible ? '600ms' : '0ms'
                }}
              >
                {percentA}%
              </span>
            )}
          </div>
        </div>

        {/* Option B */}
        <div className="relative" style={{ marginBottom: '20px' }}>
          <div className="relative h-8 rounded-full overflow-hidden bg-gray-200">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full"
              style={{
                width: visible ? `${percentB}%` : '0%',
                transition: "width 600ms ease-out 120ms",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-between" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
              <span className={`text-xs font-medium ${percentB > 0 ? 'text-white' : 'text-gray-800'}`}>
                {poll.right.emoji} {poll.right.label}
              </span>
              <span className={`text-xs font-medium ${percentB > 0 ? 'text-gray-500' : 'text-gray-700'}`}>
                {item.votes.B.toLocaleString()}표
              </span>
            </div>
            {percentB > 0 && (
              <span 
                className="text-sm font-bold text-gray-800 absolute"
                style={{
                  opacity: visible ? 1 : 0,
                  left: `${percentB}%`,
                  top: '50%',
                  transform: 'translateY(-50%) translateX(4px)',
                  transition: 'opacity 0.3s ease-out',
                  transitionDelay: visible ? '720ms' : '0ms'
                }}
              >
                {percentB}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
