"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
  const [isVisible, setIsVisible] = useState(false);
  const [animatedPercentA, setAnimatedPercentA] = useState(0);
  const [animatedPercentB, setAnimatedPercentB] = useState(0);
  const [animatedVotesA, setAnimatedVotesA] = useState(0);
  const [animatedVotesB, setAnimatedVotesB] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const [previousTotal, setPreviousTotal] = useState(0);
  const [previousPercentA, setPreviousPercentA] = useState(0);
  const [previousPercentB, setPreviousPercentB] = useState(0);
  const [previousVotesA, setPreviousVotesA] = useState(0);
  const [previousVotesB, setPreviousVotesB] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(
    () => `poll-voted-${config?.question || ""}`,
    [config?.question]
  );

  // 카드 등장 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const total = (votes?.A || 0) + (votes?.B || 0);
  const percentA = total > 0 ? Math.round(((votes?.A || 0) / total) * 100) : 50;
  const percentB = total > 0 ? Math.round(((votes?.B || 0) / total) * 100) : 50;

  // 자릿수별 개별 애니메이션 함수
  const animateDigitChange = (previous: number, current: number, setter: (value: number) => void) => {
    if (previous === current) return;
    
    const duration = 600; // 0.6초
    const steps = 20;
    const stepDuration = duration / steps;
    
    let progress = 0;
    const timer = setInterval(() => {
      progress += 1 / steps;
      if (progress >= 1) {
        setter(current);
        clearInterval(timer);
      } else {
        // 이전 값에서 현재 값으로 부드럽게 변화
        const animatedValue = previous + (current - previous) * progress;
        setter(Math.round(animatedValue));
      }
    }, stepDuration);
  };

  // 퍼센트 카운팅 애니메이션 (첫 로드 시)
  useEffect(() => {
    if (showResult && synced && previousPercentA === 0) {
      const duration = 1500; // 1.5초
      const steps = 60;
      const stepDuration = duration / steps;
      
      const animateValue = (start: number, end: number, setter: (value: number) => void) => {
        let current = start;
        const increment = (end - start) / steps;
        const timer = setInterval(() => {
          current += increment;
          if (current >= end) {
            setter(end);
            clearInterval(timer);
          } else {
            setter(Math.round(current));
          }
        }, stepDuration);
      };

      animateValue(0, percentA, setAnimatedPercentA);
      animateValue(0, percentB, setAnimatedPercentB);
      animateValue(0, votes?.A || 0, setAnimatedVotesA);
      animateValue(0, votes?.B || 0, setAnimatedVotesB);
      animateValue(0, total, setAnimatedTotal);
      
      // 첫 로드 후 이전 값들 저장
      setPreviousPercentA(percentA);
      setPreviousPercentB(percentB);
      setPreviousVotesA(votes?.A || 0);
      setPreviousVotesB(votes?.B || 0);
      setPreviousTotal(total);
    }
  }, [showResult, synced, percentA, percentB, votes?.A, votes?.B, total, previousPercentA]);

  // 업데이트 감지 시 개별 애니메이션
  useEffect(() => {
    if (showResult && synced && previousPercentA > 0) {
      // 각 값이 변경되었을 때만 해당 값만 애니메이션
      if (percentA !== previousPercentA) {
        animateDigitChange(previousPercentA, percentA, setAnimatedPercentA);
        setPreviousPercentA(percentA);
      }
      
      if (percentB !== previousPercentB) {
        animateDigitChange(previousPercentB, percentB, setAnimatedPercentB);
        setPreviousPercentB(percentB);
      }
      
      if ((votes?.A || 0) !== previousVotesA) {
        animateDigitChange(previousVotesA, votes?.A || 0, setAnimatedVotesA);
        setPreviousVotesA(votes?.A || 0);
      }
      
      if ((votes?.B || 0) !== previousVotesB) {
        animateDigitChange(previousVotesB, votes?.B || 0, setAnimatedVotesB);
        setPreviousVotesB(votes?.B || 0);
      }
      
      if (total !== previousTotal) {
        animateDigitChange(previousTotal, total, setAnimatedTotal);
        setPreviousTotal(total);
      }
    }
  }, [showResult, synced, percentA, percentB, votes?.A, votes?.B, total, previousPercentA, previousPercentB, previousVotesA, previousVotesB, previousTotal]);

  useEffect(() => {
    const savedVote = localStorage.getItem(storageKey);
    if (savedVote) {
      try {
        const data = JSON.parse(savedVote);
        setSelected(data.selected);
        setShowResult(true);
        setSynced(true); // 이미 투표한 경우 즉시 synced를 true로 설정
        // 애니메이션 상태를 현재 값으로 즉시 설정
        setAnimatedPercentA(percentA);
        setAnimatedPercentB(percentB);
        setAnimatedVotesA(votes?.A || 0);
        setAnimatedVotesB(votes?.B || 0);
        setAnimatedTotal(total);
      } catch {}
    } else {
      setSelected(null);
      setShowResult(false);
    }
  }, [storageKey, percentA, percentB, votes?.A, votes?.B, total]);

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

  // config가 변경되면 storageKey도 업데이트하고 기존 투표 상태 확인
  useEffect(() => {
    if (config) {
      const savedVote = localStorage.getItem(storageKey);
      if (savedVote) {
        const { selected } = JSON.parse(savedVote);
        setSelected(selected);
        setShowResult(true);
        setSynced(true); // 이미 투표한 경우 즉시 synced를 true로 설정
        // 애니메이션 상태를 현재 값으로 즉시 설정
        setAnimatedPercentA(percentA);
        setAnimatedPercentB(percentB);
        setAnimatedVotesA(votes?.A || 0);
        setAnimatedVotesB(votes?.B || 0);
        setAnimatedTotal(total);
      }
    }
  }, [config, storageKey, percentA, percentB, votes?.A, votes?.B, total]);

  const fetchVotes = async () => {
    try {
      setIsUpdating(true);
      const res = await fetch("/api/vote", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setVotes(data.votes);
        setSynced(true);
        
        // 서버에서 사용자의 투표 정보를 받았으면 상태 업데이트
        if (data.userVote && !selected) {
          setSelected(data.userVote);
          setShowResult(true);
          // 애니메이션 상태를 현재 값으로 즉시 설정
          setAnimatedPercentA(percentA);
          setAnimatedPercentB(percentB);
          setAnimatedVotesA(votes?.A || 0);
          setAnimatedVotesB(votes?.B || 0);
          setAnimatedTotal(total);
        }
      }
    } catch {}
    finally {
      setTimeout(() => setIsUpdating(false), 300);
    }
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
        // 서버에서 중복 투표 감지 - 알림 대신 결과 표시
        setVotes(data.votes);
        setSynced(true);
        setShowResult(true);
        // 이미 투표한 경우이므로 로컬 스토리지에 저장하지 않음
      }
    } catch {
      alert("투표에 실패했습니다. 다시 시도해주세요.");
      setSelected(null);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="text-center px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-400">
            설문조사가 아직 준비되지 않았습니다.
          </h2>
          <p className="text-sm text-gray-500 mt-4">
            관리자 페이지에서 설정해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div 
        ref={cardRef}
        className={`w-full max-w-4xl flex flex-col items-center gap-12 sm:gap-16 md:gap-20 transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
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
              ${showResult ? "cursor-default" : "cursor-pointer hover:scale-[1.05] active:scale-[0.98]"}
              ${selected === "A" ? "shadow-2xl shadow-blue-200/50" : showResult ? "shadow-lg" : "shadow-lg hover:shadow-xl hover:shadow-blue-100/30"}
            `}
          >
            <div
              className={`
                absolute inset-0 transition-all duration-500
                ${selected === "A" ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-white"}
              `}
            />

            <div className="relative h-full flex flex-col items-center justify-center p-3 sm:p-4 gap-1 sm:gap-2">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${selected === "A" ? "scale-110" : showResult ? "" : "group-hover:scale-105"}`}>
                {config.left.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold transition-colors ${selected === "A" ? "text-white" : "text-gray-800"}`}>
                {config.left.label}
              </div>
              {showResult && synced && (
                <div className={`mt-1 sm:mt-2 animate-fadeIn ${selected === "A" ? "text-white" : "text-gray-700"}`}>
                  <div className="text-xl sm:text-2xl font-bold mb-0.5">{animatedPercentA}%</div>
                  <div className={`text-xs ${selected === "A" ? "text-blue-100" : "text-gray-500"}`}>{animatedVotesA.toLocaleString()} votes</div>
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
              ${showResult ? "cursor-default" : "cursor-pointer hover:scale-[1.05] active:scale-[0.98]"}
              ${selected === "B" ? "shadow-2xl shadow-purple-200/50" : showResult ? "shadow-lg" : "shadow-lg hover:shadow-xl hover:shadow-purple-100/30"}
            `}
          >
            <div
              className={`
                absolute inset-0 transition-all duration-500
                ${selected === "B" ? "bg-gradient-to-br from-purple-500 to-purple-600" : "bg-white"}
              `}
            />

            <div className="relative h-full flex flex-col items-center justify-center p-3 sm:p-4 gap-1 sm:gap-2">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${selected === "B" ? "scale-110" : showResult ? "" : "group-hover:scale-105"}`}>
                {config.right.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold transition-colors ${selected === "B" ? "text-white" : "text-gray-800"}`}>
                {config.right.label}
              </div>
              {showResult && synced && (
                <div className={`mt-1 sm:mt-2 animate-fadeIn ${selected === "B" ? "text-white" : "text-gray-700"}`}>
                  <div className="text-xl sm:text-2xl font-bold mb-0.5">{animatedPercentB}%</div>
                  <div className={`text-xs ${selected === "B" ? "text-purple-100" : "text-gray-500"}`}>{animatedVotesB.toLocaleString()} votes</div>
                </div>
              )}
            </div>
            {selected === "B" && (
              <div className="absolute inset-0 ring-4 ring-purple-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem]" />
            )}
          </button>
        </div>

        <div className={`text-center transition-all duration-300 ${!showResult || !synced ? "invisible" : ""}`}>
          <p className="text-sm text-gray-400">
            총 {animatedTotal.toLocaleString()}명 참여
          </p>
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


