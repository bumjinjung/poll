"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { flushSync } from "react-dom";

const ANIM_MS = 600;
const REVEAL_DELAY = 90;

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
  // ===== 기본 상태 =====
  const [config, setConfig] = useState<TwoChoicePollConfig | null>(initialConfig);
  const [votes, setVotes] = useState<VoteData>(initialVotes);
  const [selected, setSelected] = useState<"A" | "B" | null>(null);
  const [pendingChoice, setPendingChoice] = useState<"A" | "B" | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [synced, setSynced] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // 숫자/텍스트 표시 타이밍(색 채움과 싱크)
  const [numbersVisible, setNumbersVisible] = useState(false);

  // 애니메이션용 숫자 (SSR과 일치)
  const [animatedPercentA, setAnimatedPercentA] = useState(() => {
    const total = initialVotes.A + initialVotes.B;
    return total > 0 ? Math.round((initialVotes.A / total) * 100) : 0;
  });
  const [animatedPercentB, setAnimatedPercentB] = useState(() => {
    const total = initialVotes.A + initialVotes.B;
    return total > 0 ? Math.round((initialVotes.B / total) * 100) : 0;
  });
  const [animatedVotesA, setAnimatedVotesA] = useState(initialVotes.A);
  const [animatedVotesB, setAnimatedVotesB] = useState(initialVotes.B);
  const [animatedTotal, setAnimatedTotal] = useState(initialVotes.A + initialVotes.B);

  // 이전 값들
  const [previousTotal, setPreviousTotal] = useState(0);
  const [previousPercentA, setPreviousPercentA] = useState(0);
  const [previousPercentB, setPreviousPercentB] = useState(0);
  const [previousVotesA, setPreviousVotesA] = useState(0);
  const [previousVotesB, setPreviousVotesB] = useState(0);

  const [questionKey, setQuestionKey] = useState(0);
  const [voteEffect, setVoteEffect] = useState<"A" | "B" | null>(null);

  // Refs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const hasShownResultRef = useRef(false);
  const hasVotedRef = useRef<"A" | "B" | null>(null);

  const storageKey = useMemo(
    () => `poll-voted-${config?.question || ""}`,
    [config?.question]
  );

  // 파생값
  const total = (votes?.A || 0) + (votes?.B || 0);
  const percentA = total > 0 ? Math.round(((votes?.A || 0) / total) * 100) : 0;
  const percentB = total > 0 ? Math.round(((votes?.B || 0) / total) * 100) : 0;

  const isAActive = selected === "A" || pendingChoice === "A";
  const isBActive = selected === "B" || pendingChoice === "B";

  // 결과 블록은 한번 열리면 유지 (조건 단순화)
  const canShowStats = showResult;
  
  const showNumbers = showResult && numbersVisible;

  // ===== 등장 애니메이션 =====
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // ===== 숫자 애니메이션 유틸 =====
  const animateDigitChange = (from: number, to: number, setter: (n: number) => void) => {
    if (from === to) return;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min((t - start) / ANIM_MS, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setter(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const applyAnimatedSnapshot = useCallback((base: VoteData, extra?: "A" | "B") => {
    const nextA = base.A + (extra === "A" ? 1 : 0);
    const nextB = base.B + (extra === "B" ? 1 : 0);
    const nextTotal = nextA + nextB;
    const nextPercentA = nextTotal ? Math.round((nextA / nextTotal) * 100) : 0;
    const nextPercentB = nextTotal ? 100 - nextPercentA : 0;

    setAnimatedVotesA(nextA);
    setAnimatedVotesB(nextB);
    setAnimatedTotal(nextTotal);
    setAnimatedPercentA(nextPercentA);
    setAnimatedPercentB(nextPercentB);

    setPreviousVotesA(nextA);
    setPreviousVotesB(nextB);
    setPreviousTotal(nextTotal);
    setPreviousPercentA(nextPercentA);
    setPreviousPercentB(nextPercentB);
  }, []);

  // 최초 결과 오픈 시(내가 투표 안했을 때)만 0→실값 카운팅
  useEffect(() => {
    if (!showResult || !synced || previousPercentA !== 0) return;
    if (selected) {
      setPreviousPercentA(percentA);
      setPreviousPercentB(percentB);
      setPreviousVotesA(votes?.A || 0);
      setPreviousVotesB(votes?.B || 0);
      setPreviousTotal(total);
      return;
    }
    const start = performance.now();
    const duration = ANIM_MS;
    const fromTo = [
      [0, percentA, setAnimatedPercentA],
      [0, percentB, setAnimatedPercentB],
      [0, votes?.A || 0, setAnimatedVotesA],
      [0, votes?.B || 0, setAnimatedVotesB],
      [0, total, setAnimatedTotal],
    ] as const;
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      for (const [from, to, set] of fromTo) set(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    setPreviousPercentA(percentA);
    setPreviousPercentB(percentB);
    setPreviousVotesA(votes?.A || 0);
    setPreviousVotesB(votes?.B || 0);
    setPreviousTotal(total);
  }, [showResult, synced, previousPercentA, selected, percentA, percentB, votes?.A, votes?.B, total]);

  // 이후 업데이트는 변화분만
  useEffect(() => {
    if (!canShowStats || previousPercentA === 0) return;
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
  }, [
    canShowStats,
    percentA, percentB, votes?.A, votes?.B, total,
    previousPercentA, previousPercentB, previousVotesA, previousVotesB, previousTotal
  ]);

  // ===== 서버 통신 =====
  const fetchVotes = useCallback(async () => {
    try {
      setIsUpdating(true);
      const res = await fetch("/api/vote", { cache: "no-store" });
      const data = await res.json();
      if (!data?.success) return;

      const v = data.votes;
      setVotes(v);
      setSynced(true);

      // 애니메이션 값도 즉시 업데이트
      const newTotal = v.A + v.B;
      const newPercentA = newTotal ? Math.round((v.A / newTotal) * 100) : 0;
      const newPercentB = newTotal ? 100 - newPercentA : 0;
      
      setAnimatedVotesA(v.A);
      setAnimatedVotesB(v.B);
      setAnimatedTotal(newTotal);
      setAnimatedPercentA(newPercentA);
      setAnimatedPercentB(newPercentB);
      setPreviousVotesA(v.A);
      setPreviousVotesB(v.B);
      setPreviousTotal(newTotal);
      setPreviousPercentA(newPercentA);
      setPreviousPercentB(newPercentB);

      if (data.userVote) {
        hasVotedRef.current = data.userVote;
        setSelected(data.userVote);

        if (!hasShownResultRef.current) {
          setShowResult(true);
          hasShownResultRef.current = true;
          setNumbersVisible(false);
          setTimeout(() => setNumbersVisible(true), REVEAL_DELAY);
        } else {
          setShowResult(true);
          setNumbersVisible(true);
        }

        try {
          const currentStorageKey = `poll-voted-${config?.question || ""}`;
          localStorage.setItem(currentStorageKey, JSON.stringify({ selected: data.userVote }));
        } catch {}
      } else {
        hasVotedRef.current = null;
        hasShownResultRef.current = false;
        setSelected(null);
        setShowResult(false);
        setSynced(false);
        setNumbersVisible(false);

        try {
          const currentStorageKey = `poll-voted-${config?.question || ""}`;
          localStorage.removeItem(currentStorageKey);
        } catch {}
      }
    } finally {
      setTimeout(() => setIsUpdating(false), 180);
    }
  }, [config?.question]);

  // ===== 2초 간격 폴링 =====
  useEffect(() => {
    // 초기 로드
    fetchVotes();

    // 2초마다 폴링
    pollIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        fetchVotes();
      }
    }, 2000);

    // 이벤트 리스너
    const onFocus = () => fetchVotes();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted || (document as any).wasDiscarded) fetchVotes();
    };
    const onOnline = () => fetchVotes();

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow as any);
    window.addEventListener("online", onOnline);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow as any);
      window.removeEventListener("online", onOnline);
    };
  }, [fetchVotes]);

  // showResult가 열린 "그 순간"만 숫자 공개 연출
  useEffect(() => {
    if (showResult && !hasShownResultRef.current) {
      hasShownResultRef.current = true;
      setNumbersVisible(false);
      const t = setTimeout(() => setNumbersVisible(true), REVEAL_DELAY);
      return () => clearTimeout(t);
    }
  }, [showResult]);

  // 질문 변경 시 초기화
  const prevQuestionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!config) return;
    const prevQ = prevQuestionRef.current;
    if (prevQ && prevQ !== config.question) {
      try {
        localStorage.removeItem(`poll-voted-${prevQ}`);
      } catch {}
    }
    prevQuestionRef.current = config.question;
    setQuestionKey((k) => k + 1);

    setPreviousPercentA(0);
    setPreviousPercentB(0);
    setPreviousVotesA(0);
    setPreviousVotesB(0);
    setPreviousTotal(0);
    setAnimatedPercentA(0);
    setAnimatedPercentB(0);
    setAnimatedVotesA(0);
    setAnimatedVotesB(0);
    setAnimatedTotal(0);
    setPendingChoice(null);
    setSynced(false);

    setShowResult(false);
    hasShownResultRef.current = false;
    hasVotedRef.current = null;
    setNumbersVisible(false);

    fetchVotes();
  }, [config?.question, fetchVotes]);

  // 로컬 저장된 내 투표 빠른 반영(최초 진입만)
  useEffect(() => {
    if (!config?.question) return;
    try {
      const raw = localStorage.getItem(`poll-voted-${config.question}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { selected?: "A" | "B" };
        if (parsed?.selected) {
          hasVotedRef.current = parsed.selected;
          setSelected(parsed.selected);
          setShowResult(true);
          if (!hasShownResultRef.current) {
            hasShownResultRef.current = true;
            setNumbersVisible(false);
            setTimeout(() => setNumbersVisible(true), REVEAL_DELAY);
          }
          fetchVotes();
          return;
        }
      }
    } catch {}
    setSelected(null);
    setShowResult(false);
    setSynced(false);
    setNumbersVisible(false);
    fetchVotes();
  }, [config?.question, fetchVotes]);

  // 투표 처리
  const handleVote = async (choice: "A" | "B") => {
    if (showResult) return;
    
    navigator.vibrate?.(20);
    
    // 즉시 UI 업데이트 (낙관적 업데이트)
    flushSync(() => {
      const nextA = votes.A + (choice === "A" ? 1 : 0);
      const nextB = votes.B + (choice === "B" ? 1 : 0);
      const nextTotal = nextA + nextB;
      const nextPercentA = nextTotal ? Math.round((nextA / nextTotal) * 100) : 0;
      const nextPercentB = nextTotal ? 100 - nextPercentA : 0;
      
      setAnimatedVotesA(nextA);
      setAnimatedVotesB(nextB);
      setAnimatedTotal(nextTotal);
      setAnimatedPercentA(nextPercentA);
      setAnimatedPercentB(nextPercentB);
      setPreviousVotesA(nextA);
      setPreviousVotesB(nextB);
      setPreviousTotal(nextTotal);
      setPreviousPercentA(nextPercentA);
      setPreviousPercentB(nextPercentB);
      
      setSelected(choice);
      setShowResult(true);
      setNumbersVisible(true);
    });
    
    hasVotedRef.current = choice;
    hasShownResultRef.current = true;
    
    // 투표 효과
    setVoteEffect(choice);
    setTimeout(() => setVoteEffect(null), 600);

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const data = await res.json();
      
      if (data.success && data.votes) {
        // 서버 응답으로 실제 값 업데이트하되, 이미 낙관적으로 올린 값이 맞는지만 확인
        const serverA = data.votes.A;
        const serverB = data.votes.B;
        
        // votes 상태는 항상 서버 값으로 동기화
        setVotes({ A: serverA, B: serverB });
        
        try {
          localStorage.setItem(storageKey, JSON.stringify({ selected: choice }));
        } catch {}
        
        try {
          if (!bcRef.current) bcRef.current = new BroadcastChannel("poll_channel");
          bcRef.current.postMessage({ type: "vote_update_hint" });
        } catch {}
      }
    } catch (error) {
      console.error("투표 실패:", error);
      alert("투표에 실패했습니다. 다시 시도해주세요.");
      
      // 실패 시 이전 값으로 되돌리기
      setSelected(null);
      setShowResult(false);
      setNumbersVisible(false);
      hasVotedRef.current = null;
      hasShownResultRef.current = false;
      
      // 이전 투표 수로 되돌리기
      setAnimatedVotesA(votes.A);
      setAnimatedVotesB(votes.B);
      setAnimatedTotal(votes.A + votes.B);
      const pA = votes.A + votes.B > 0 ? Math.round((votes.A / (votes.A + votes.B)) * 100) : 0;
      const pB = votes.A + votes.B > 0 ? 100 - pA : 0;
      setAnimatedPercentA(pA);
      setAnimatedPercentB(pB);
      setPreviousVotesA(votes.A);
      setPreviousVotesB(votes.B);
      setPreviousTotal(votes.A + votes.B);
      setPreviousPercentA(pA);
      setPreviousPercentB(pB);
    }
  };

  // 관리자 강제 리프레시
  const forceRefreshConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/today", { cache: "no-store" });
      const data = await res.json();
      if (data?.data) {
        setConfig(data.data);
      }
    } catch {}
  }, []);

  // 브로드캐스트 수신
  useEffect(() => {
    const bc = new BroadcastChannel("poll_channel");
    bcRef.current = bc;

    bc.onmessage = (event) => {
      if (event.data.type === "config_update") {
        forceRefreshConfig();
      }
      if (event.data.type === "vote_update_hint") {
        fetchVotes();
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === "poll:config:ver" && e.newValue) {
        forceRefreshConfig();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      bc.close();
      window.removeEventListener("storage", onStorage);
      if (bcRef.current) bcRef.current = null;
    };
  }, [forceRefreshConfig, fetchVotes]);

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="text-center px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-400">
            설문조사가 아직 준비되지 않았습니다.
          </h2>
          <p className="text-sm text-gray-500 mt-4">관리자 페이지에서 설정해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl flex flex-col items-center gap-12 sm:gap-16 md:gap-20 transition-all duration-500 ease-out">
        <div className="text-center px-4">
          <h2
            key={questionKey}
            className={`text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-800 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            } transition-all duration-700`}
          >
            {config.question}
          </h2>
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-4">
          {/* A */}
          <button
            onClick={() => handleVote("A")}
            disabled={showResult}
            className={`
              group relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out touch-manipulation select-none
              ${showResult ? "cursor-default" : "cursor-pointer active:scale-[0.98] hover:scale-[1.05]"}
              ${isAActive ? "shadow-[0_16px_40px_rgba(37,99,235,0.28)] scale-[1.03]" : "shadow-lg"}
            `}
            aria-pressed={isAActive}
          >
            {isAActive && <div className="absolute inset-0 bg-black/5 md:backdrop-blur-[1px] pointer-events-none" />}
            {isAActive && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "conic-gradient(from 0deg, transparent, rgba(37,99,235,.3), transparent)", borderRadius: "inherit" }}
              >
                <div className="animate-ringSweep w-full h-full" />
              </div>
            )}
            {!showResult && (
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-blue-400/40 to-blue-500/30 opacity-0 group-hover:opacity-100 transition-all"
                style={{ transform: "scaleY(0)", transformOrigin: "bottom", transition: `opacity 300ms ease, transform ${ANIM_MS}ms ease-out` }}
              />
            )}
              <div
                className={`absolute inset-0 z-0 transition-transform origin-bottom ${
                  isAActive ? "bg-gradient-to-br from-blue-500 to-blue-600 scale-y-100" : "bg-neutral-50 scale-y-0"
                }`}
                style={{ transitionDuration: `${ANIM_MS}ms`, transformOrigin: "bottom center" }}
              />
            <div className={`relative z-10 h-full flex flex-col items-center p-3 sm:p-4 gap-1 sm:gap-2 ${
              showNumbers ? "justify-center" : "justify-center"
            }`}>
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isAActive ? "scale-110 animate-emojiBounce" : ""}`}>
                {config.left.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold ${isAActive ? "text-white" : "text-gray-800"}`}>
                {config.left.label}
              </div>
              {showNumbers && (
                <div className={`transition-opacity duration-200 ${isAActive ? "text-white" : "text-gray-900"}`}>
                  <div className="text-xl sm:text-2xl font-bold mb-0.5">{animatedPercentA}%</div>
                  <div className={`text-xs ${isAActive ? "text-blue-100" : "text-gray-600"}`}>{animatedVotesA.toLocaleString()} votes</div>
                </div>
              )}
            </div>
            {isAActive && <div className="absolute inset-0 ring-4 ring-blue-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem]" />}
            {voteEffect === "A" && (
              <div
                className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(59,130,246,.3) 0%, transparent 70%)", animation: "votePopEffect 0.6s ease-out forwards" }}
              />
            )}
          </button>

          {/* B */}
          <button
            onClick={() => handleVote("B")}
            disabled={showResult}
            className={`
              group relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out touch-manipulation select-none
              ${showResult ? "cursor-default" : "cursor-pointer active:scale-[0.98] hover:scale-[1.05]"}
              ${isBActive ? "shadow-[0_16px_40px_rgba(147,51,234,0.28)] scale-[1.03]" : "shadow-lg"}
            `}
            aria-pressed={isBActive}
          >
            {isBActive && <div className="absolute inset-0 bg-black/5 md:backdrop-blur-[1px] pointer-events-none" />}
            {isBActive && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "conic-gradient(from 0deg, transparent, rgba(147,51,234,.3), transparent)", borderRadius: "inherit" }}
              >
                <div className="animate-ringSweep w-full h-full" />
              </div>
            )}
            {!showResult && (
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-purple-400/40 to-purple-500/30 opacity-0 group-hover:opacity-100 transition-all"
                style={{ transform: "scaleY(0)", transformOrigin: "bottom", transition: `opacity 300ms ease, transform ${ANIM_MS}ms ease-out` }}
              />
            )}
              <div
                className={`absolute inset-0 z-0 transition-transform origin-bottom ${
                  isBActive ? "bg-gradient-to-br from-purple-500 to-purple-600 scale-y-100" : "bg-neutral-50 scale-y-0"
                }`}
                style={{ transitionDuration: `${ANIM_MS}ms`, transformOrigin: "bottom center" }}
              />
            <div className={`relative z-10 h-full flex flex-col items-center p-3 sm:p-4 gap-1 sm:gap-2 ${
              showNumbers ? "justify-center" : "justify-center"
            }`}>
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isBActive ? "scale-110 animate-emojiBounce" : ""}`}>
                {config.right.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold ${isBActive ? "text-white" : "text-gray-800"}`}>
                {config.right.label}
              </div>
              {showNumbers && (
                <div className={`transition-opacity duration-200 ${isBActive ? "text-white" : "text-gray-900"}`}>
                  <div className="text-xl sm:text-2xl font-bold mb-0.5">{animatedPercentB}%</div>
                  <div className={`text-xs ${isBActive ? "text-purple-100" : "text-gray-600"}`}>{animatedVotesB.toLocaleString()} votes</div>
                </div>
              )}
            </div>
            {isBActive && <div className="absolute inset-0 ring-4 ring-purple-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem]" />}
            {voteEffect === "B" && (
              <div
                className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(147,51,234,.3) 0%, transparent 70%)", animation: "votePopEffect 0.6s ease-out forwards" }}
              />
            )}
          </button>
        </div>

        {canShowStats && (
          <div className="text-center flex flex-col items-center gap-2">
            <p 
              className="text-sm text-gray-400 animate-fadeInSlideUp"
              style={{ animationDelay: "200ms" }}
            >
              총 <span className="inline-block">{animatedTotal.toLocaleString()}</span>명 참여
            </p>
            <Link 
              href="/history" 
              className="inline-block text-xs text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-105 animate-fadeInSlideUp"
              style={{ animationDelay: "350ms" }}
            >
              이전 설문 결과 보기 →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
