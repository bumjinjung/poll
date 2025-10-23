"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  initialConfig: TwoChoicePollConfig | null;
  initialVotes: VoteData;
}) {
  const [config, setConfig] = useState<TwoChoicePollConfig | null>(initialConfig);
  const [votes, setVotes] = useState<VoteData>(initialVotes);
  const [selected, setSelected] = useState<"A" | "B" | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [synced, setSynced] = useState(false);

  const storageKey = useMemo(
    () => `poll-voted-${config?.question || ""}`,
    [config?.question]
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

  useEffect(() => {
    // 마운트 즉시 한 번 최신 투표 수를 가져와 SSR과의 차이를 없앰
    fetchVotes();
    
    // 마운트 직후 즉시 최신 설문 데이터 확인 (이전 내용 표시 방지)
    const checkLatestConfig = async () => {
      try {
        const res = await fetch("/api/admin/today", { cache: "no-store" });
        const data = await res.json();
        if (data?.data && JSON.stringify(data.data) !== JSON.stringify(config)) {
          setConfig(data.data);
          setSelected(null);
          setShowResult(false);
          const newStorageKey = `poll-voted-${data.data.question}`;
          localStorage.removeItem(newStorageKey);
        } else if (data?.data) {
          // 설문이 같으면 기존 투표 상태 확인
          const savedVote = localStorage.getItem(storageKey);
          if (savedVote) {
            const { selected } = JSON.parse(savedVote);
            setSelected(selected);
            setShowResult(true);
          }
        }
      } catch {}
    };
    checkLatestConfig();
    
    // 매 2초마다 설문 데이터 갱신 확인
    const configCheckInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/today", { cache: "no-store" });
        const data = await res.json();
        if (data?.data && JSON.stringify(data.data) !== JSON.stringify(config)) {
          // 설문이 바뀌면 즉시 갱신
          setConfig(data.data);
          setSelected(null);
          setShowResult(false);
          // 새 설문이므로 로컬 스토리지에서도 해당 기록 제거
          const newStorageKey = `poll-voted-${data.data.question}`;
          localStorage.removeItem(newStorageKey);
        } else if (data?.data) {
          // 설문이 같으면 기존 투표 상태 확인
          const savedVote = localStorage.getItem(storageKey);
          if (savedVote) {
            const { selected } = JSON.parse(savedVote);
            setSelected(selected);
            setShowResult(true);
          }
        }
      } catch {}
    }, 2000);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => clearInterval(configCheckInterval);
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
      } else {
        // 서버에서 중복 투표 감지
        alert(data.message || "투표에 실패했습니다.");
        setSelected(null);
      }
    } catch {
      alert("투표에 실패했습니다. 다시 시도해주세요.");
      setSelected(null);
    }
  };

  const total = votes.A + votes.B;
  const percentA = total > 0 ? Math.round((votes.A / total) * 100) : 50;
  const percentB = total > 0 ? Math.round((votes.B / total) * 100) : 50;

  if (!config) {
    return (
      <div className="h-screen overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-4xl flex flex-col items-center gap-12 sm:gap-16 md:gap-20">
          <div className="text-center px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-400">
              설문조사가 아직 준비되지 않았습니다.
            </h2>
            <p className="text-sm text-gray-500 mt-4">
              관리자 페이지에서 설정해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6">
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

        <div className={`text-center ${!showResult || !synced ? "invisible" : ""}`}>
          <p className="text-sm text-gray-400">총 {total.toLocaleString()}명 참여</p>
          <Link 
            href="/history" 
            className="inline-block mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            이전 설문 결과 보기
          </Link>
        </div>
      </div>
    </div>
  );
}


