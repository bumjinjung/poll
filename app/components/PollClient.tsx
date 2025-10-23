"use client";

import { useEffect, useMemo, useState } from "react";

type TwoChoicePollConfig = {
  question: string;
  left: { label: string; emoji?: string };
  right: { label: string; emoji?: string };
};

type VoteData = { A: number; B: number };

export default function PollClient({
  initialConfig,
  initialVotes,
}: {
  initialConfig: TwoChoicePollConfig;
  initialVotes: VoteData;
}) {
  const [config, setConfig] = useState<TwoChoicePollConfig>(initialConfig);
  const [votes, setVotes] = useState<VoteData>(initialVotes);
  const [selected, setSelected] = useState<"A" | "B" | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [synced, setSynced] = useState(false);

  const storageKey = useMemo(
    () => `poll-voted-${config.question}`,
    [config.question]
  );

  useEffect(() => {
    const savedVote = localStorage.getItem(storageKey);
    if (savedVote) {
      try {
        const data = JSON.parse(savedVote);
        setSelected(data.selected);
        setShowResult(true);
      } catch {}
    } else {
      setSelected(null);
      setShowResult(false);
    }
  }, [storageKey]);

  useEffect(() => {
    // 첫 로드에 한 번 즉시 갱신 (결과 표시 중이면)
    if (showResult) {
      fetchVotes();
    }
    const id = setInterval(() => {
      if (showResult) {
        fetchVotes();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [showResult]);

  // 마운트 즉시 한 번 최신 투표 수를 가져와 SSR과의 차이를 없앰
  useEffect(() => {
    fetchVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 저장된 투표로 결과 표시 전환되면 즉시 최신값으로 동기화
  useEffect(() => {
    if (showResult) {
      fetchVotes();
    }
  }, [showResult, storageKey]);

  const fetchVotes = async () => {
    try {
      const res = await fetch("/api/vote", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setVotes(data.votes);
        setSynced(true);
      }
    } catch {}
  };

  const handleVote = async (choice: "A" | "B") => {
    if (showResult) return;
    setSelected(choice);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const data = await res.json();
      if (data.success) {
        setVotes(data.votes);
        setTimeout(() => {
          setSynced(true);
          setShowResult(true);
          localStorage.setItem(storageKey, JSON.stringify({ selected: choice }));
        }, 400);
      }
    } catch {
      alert("투표에 실패했습니다. 다시 시도해주세요.");
      setSelected(null);
    }
  };

  const total = votes.A + votes.B;
  const percentA = total > 0 ? Math.round((votes.A / total) * 100) : 50;
  const percentB = total > 0 ? Math.round((votes.B / total) * 100) : 50;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl flex flex-col items-center gap-12 sm:gap-16 md:gap-20">
        <div className="text-center px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-800">
            {config.question}
          </h2>
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={() => handleVote("A")}
            disabled={showResult}
            className={`
              group relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out
              ${showResult ? "cursor-default" : "cursor-pointer hover:scale-[1.02]"}
              ${selected === "A" ? "shadow-2xl shadow-blue-200/50" : "shadow-lg hover:shadow-xl"}
            `}
          >
            <div
              className={`
                absolute inset-0 transition-all duration-500
                ${selected === "A" ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-white"}
              `}
            />

            <div className="relative h-full flex flex-col items-center justify-center p-3 sm:p-4 gap-1 sm:gap-2">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${selected === "A" ? "scale-110" : "group-hover:scale-105"}`}>
                {config.left.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold transition-colors ${selected === "A" ? "text-white" : "text-gray-800"}`}>
                {config.left.label}
              </div>
              {showResult && synced && (
                <div className={`mt-1 sm:mt-2 animate-fadeIn ${selected === "A" ? "text-white" : "text-gray-700"}`}>
                  <div className="text-xl sm:text-2xl font-bold mb-0.5">{percentA}%</div>
                  <div className={`text-xs ${selected === "A" ? "text-blue-100" : "text-gray-500"}`}>{votes.A} votes</div>
                </div>
              )}
            </div>
            {selected === "A" && (
              <div className="absolute inset-0 ring-4 ring-blue-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem]" />
            )}
          </button>

          <button
            onClick={() => handleVote("B")}
            disabled={showResult}
            className={`
              group relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out
              ${showResult ? "cursor-default" : "cursor-pointer hover:scale-[1.02]"}
              ${selected === "B" ? "shadow-2xl shadow-purple-200/50" : "shadow-lg hover:shadow-xl"}
            `}
          >
            <div
              className={`
                absolute inset-0 transition-all duration-500
                ${selected === "B" ? "bg-gradient-to-br from-purple-500 to-purple-600" : "bg-white"}
              `}
            />

            <div className="relative h-full flex flex-col items-center justify-center p-3 sm:p-4 gap-1 sm:gap-2">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${selected === "B" ? "scale-110" : "group-hover:scale-105"}`}>
                {config.right.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold transition-colors ${selected === "B" ? "text-white" : "text-gray-800"}`}>
                {config.right.label}
              </div>
              {showResult && synced && (
                <div className={`mt-1 sm:mt-2 animate-fadeIn ${selected === "B" ? "text-white" : "text-gray-700"}`}>
                  <div className="text-xl sm:text-2xl font-bold mb-0.5">{percentB}%</div>
                  <div className={`text-xs ${selected === "B" ? "text-purple-100" : "text-gray-500"}`}>{votes.B} votes</div>
                </div>
              )}
            </div>
            {selected === "B" && (
              <div className="absolute inset-0 ring-4 ring-purple-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem]" />
            )}
          </button>
        </div>

        {showResult && synced && (
          <div className="text-center">
            <p className="text-sm text-gray-400">총 {total.toLocaleString()}명 참여</p>
          </div>
        )}
      </div>
    </div>
  );
}


