"use client";

import { useState, useEffect } from "react";

type TwoChoicePollConfig = {
  question: string;
  left: { label: string; emoji?: string };
  right: { label: string; emoji?: string };
};

export default function Home() {
  const [selected, setSelected] = useState<"A" | "B" | null>(null);
  const [votes, setVotes] = useState({ A: 0, B: 0 });
  const [showResult, setShowResult] = useState(false);
  const [config, setConfig] = useState<TwoChoicePollConfig>({
    question: "민초 vs 반민초",
    left: { label: "민초", emoji: "🍦" },
    right: { label: "반민초", emoji: "🙅" },
  });

  // 질문별로 로컬 스토리지 키를 분리(질문이 바뀌면 신규 투표로 취급)
  const storageKey = `poll-voted-${config.question}`;

  // 초기 데이터 로드
  useEffect(() => {
    fetchPollData();
  }, []);

  // 실시간 업데이트 (5초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      if (showResult) {
        fetchVotes();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [showResult]);

  // 설문 데이터 + 투표 결과 조회
  const fetchPollData = async () => {
    try {
      const res = await fetch("/api/admin/today", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setVotes(data.votes || { A: 0, B: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch poll data:", error);
    }
  };

  // 투표 결과만 조회
  const fetchVotes = async () => {
    try {
      const res = await fetch("/api/vote", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setVotes(data.votes);
      }
    } catch (error) {
      console.error("Failed to fetch votes:", error);
    }
  };

  // 질문이 바뀌면 투표 상태 초기화
  useEffect(() => {
    const savedVote = localStorage.getItem(storageKey);
    if (savedVote) {
      const data = JSON.parse(savedVote);
      setSelected(data.selected);
      setShowResult(true);
    } else {
      setSelected(null);
      setShowResult(false);
    }
  }, [storageKey]);

  const handleVote = async (choice: "A" | "B") => {
    if (showResult) return;

    setSelected(choice);

    try {
      // 서버에 투표 전송
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });

      const data = await res.json();

      if (data.success) {
        // 서버에서 받은 실제 투표 결과 반영
        setVotes(data.votes);

        setTimeout(() => {
          setShowResult(true);
          // 로컬 스토리지에는 내가 선택한 것만 저장 (중복 투표 방지용)
          localStorage.setItem(storageKey, JSON.stringify({ selected: choice }));
        }, 400);
      }
    } catch (error) {
      console.error("Failed to vote:", error);
      alert("투표에 실패했습니다. 다시 시도해주세요.");
      setSelected(null);
    }
  };

  const total = votes.A + votes.B;
  const percentA = total > 0 ? Math.round((votes.A / total) * 100) : 50;
  const percentB = total > 0 ? Math.round((votes.B / total) * 100) : 50;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl flex flex-col items-center gap-20">
        {/* 질문 */}
        <div className="text-center">
          <h2 className="text-4xl font-semibold text-gray-800">
            {config.question}
          </h2>
        </div>

        {/* 선택지 - 좌우 배치 */}
        <div className="flex items-center justify-center gap-4">
          {/* 왼쪽(A) 버튼 */}
          <button
            onClick={() => handleVote("A")}
            disabled={showResult}
            className={`
              group relative w-52 h-52 rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out
              ${showResult ? "cursor-default" : "cursor-pointer hover:scale-[1.02]"}
              ${
                selected === "A"
                  ? "shadow-2xl shadow-blue-200/50"
                  : "shadow-lg hover:shadow-xl"
              }
            `}
          >
            {/* 배경 */}
            <div className={`
              absolute inset-0 transition-all duration-500
              ${
                selected === "A"
                  ? "bg-gradient-to-br from-blue-500 to-blue-600"
                  : "bg-white"
              }
            `} />

            {/* 콘텐츠 */}
            <div className="relative h-full flex flex-col items-center justify-center p-4 gap-2">
              <div className={`text-5xl transition-transform duration-300 ${selected === "A" ? "scale-110" : "group-hover:scale-105"}`}>
                {config.left.emoji ?? ""}
              </div>
              <div className={`text-lg font-semibold transition-colors ${selected === "A" ? "text-white" : "text-gray-800"}`}>
                {config.left.label}
              </div>

              {showResult && (
                <div className={`mt-2 animate-fadeIn ${selected === "A" ? "text-white" : "text-gray-700"}`}>
                  <div className="text-2xl font-bold mb-0.5">{percentA}%</div>
                  <div className={`text-xs ${selected === "A" ? "text-blue-100" : "text-gray-500"}`}>
                    {votes.A} votes
                  </div>
                </div>
              )}
            </div>

            {/* 선택 링 */}
            {selected === "A" && (
              <div className="absolute inset-0 ring-4 ring-blue-400 ring-offset-4 ring-offset-transparent rounded-[2rem]" />
            )}
          </button>

          {/* 오른쪽(B) 버튼 */}
          <button
            onClick={() => handleVote("B")}
            disabled={showResult}
            className={`
              group relative w-52 h-52 rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out
              ${showResult ? "cursor-default" : "cursor-pointer hover:scale-[1.02]"}
              ${
                selected === "B"
                  ? "shadow-2xl shadow-purple-200/50"
                  : "shadow-lg hover:shadow-xl"
              }
            `}
          >
            {/* 배경 */}
            <div className={`
              absolute inset-0 transition-all duration-500
              ${
                selected === "B"
                  ? "bg-gradient-to-br from-purple-500 to-purple-600"
                  : "bg-white"
              }
            `} />

            {/* 콘텐츠 */}
            <div className="relative h-full flex flex-col items-center justify-center p-4 gap-2">
              <div className={`text-5xl transition-transform duration-300 ${selected === "B" ? "scale-110" : "group-hover:scale-105"}`}>
                {config.right.emoji ?? ""}
              </div>
              <div className={`text-lg font-semibold transition-colors ${selected === "B" ? "text-white" : "text-gray-800"}`}>
                {config.right.label}
              </div>

              {showResult && (
                <div className={`mt-2 animate-fadeIn ${selected === "B" ? "text-white" : "text-gray-700"}`}>
                  <div className="text-2xl font-bold mb-0.5">{percentB}%</div>
                  <div className={`text-xs ${selected === "B" ? "text-purple-100" : "text-gray-500"}`}>
                    {votes.B} votes
                  </div>
                </div>
              )}
            </div>

            {/* 선택 링 */}
            {selected === "B" && (
              <div className="absolute inset-0 ring-4 ring-purple-400 ring-offset-4 ring-offset-transparent rounded-[2rem]" />
            )}
          </button>
        </div>

        {/* 하단 정보 */}
        {showResult && (
          <div className="text-center">
            <p className="text-sm text-gray-400">
              총 {total.toLocaleString()}명 참여
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
