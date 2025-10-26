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
  const sseRef = useRef<EventSource | null>(null);
  const sseConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffAttemptRef = useRef(0);
  const bcRef = useRef<BroadcastChannel | null>(null);
  // 깜빡임 방지용
  const hasShownResultRef = useRef(false);
  const hasVotedRef = useRef<"A" | "B" | null>(null);
  
  // 낙관적 하한선 (다른 함수에서 사용)
  const optimisticFloorRef = useRef<{ A: number; B: number } | null>(null);
  const clearOptimisticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  
  const showNumbers = showResult && (numbersVisible || pendingChoice !== null);

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

  // ===== 낙관적 하한선 유틸 & 강제 동기화 =====
  const applyOptimisticFloor = useCallback((v: VoteData): VoteData => {
    const floor = optimisticFloorRef.current;
    if (!floor) return v;
    return { A: Math.max(v.A, floor.A), B: Math.max(v.B, floor.B) };
  }, []);

  const forceSyncAfterVote = useCallback(async () => {
    const start = Date.now();
    const timeoutMs = 2500;
    const gapMs = 250;
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch("/api/vote", { cache: "no-store" });
        const data = await res.json();
        if (data?.success) {
          const v = applyOptimisticFloor(data.votes as VoteData);
          let changed = false;
          setVotes(prev => {
            if (prev.A !== v.A || prev.B !== v.B) {
              changed = true;
              return v;
            }
            return prev;
          });
          if (changed) {
            const tot = v.A + v.B;
            const pA = tot ? Math.round((v.A / tot) * 100) : 0;
            const pB = tot ? 100 - pA : 0;
            setAnimatedVotesA(v.A);
            setAnimatedVotesB(v.B);
            setAnimatedTotal(tot);
            setAnimatedPercentA(pA);
            setAnimatedPercentB(pB);
            setSynced(true);
            break;
          }
        }
      } catch {}
      await new Promise(r => setTimeout(r, gapMs));
    }
  }, [applyOptimisticFloor]);

  // ===== 서버 통신 =====
  const fetchVotes = useCallback(async () => {
    try {
      setIsUpdating(true);
      const res = await fetch("/api/vote", { cache: "no-store" });
      const data = await res.json();
      if (!data?.success) return;

      // ★ 서버 값에도 하한선 적용
      const v = applyOptimisticFloor(data.votes as VoteData);
      setVotes(v);
      setSynced(true);
      setNumbersVisible(true); // 동기화 도착 시에도 확실히 켭니다

      if (data.userVote) {
        hasVotedRef.current = data.userVote;
        setSelected(data.userVote);

        if (!hasShownResultRef.current) {
        setShowResult(true);
          hasShownResultRef.current = true;
          setNumbersVisible(false);
          setTimeout(() => setNumbersVisible(true), REVEAL_DELAY);
        }

        const newTotal = v.A + v.B;
        const newPercentA = newTotal ? Math.round((v.A / newTotal) * 100) : 0;
        const newPercentB = newTotal ? 100 - newPercentA : 0;
        setAnimatedVotesA(v.A);
        setAnimatedVotesB(v.B);
        setAnimatedTotal(newTotal);
        setAnimatedPercentA(newPercentA);
        setAnimatedPercentB(newPercentB);

        try {
          const currentStorageKey = `poll-voted-${config?.question || ""}`;
          localStorage.setItem(currentStorageKey, JSON.stringify({ selected: data.userVote }));
      } catch {}
    } else {
        // 🔥 서버에 투표 기록이 없다고 명시 → 로컬 기록/상태를 항상 초기화
        hasVotedRef.current = null;
        hasShownResultRef.current = false;

      setSelected(null);
      setShowResult(false);
        setSynced(false);
        setNumbersVisible(false);

        // 낙관적 하한선 / 타이머도 정리
        optimisticFloorRef.current = null;
        if (clearOptimisticTimerRef.current) {
          clearTimeout(clearOptimisticTimerRef.current);
          clearOptimisticTimerRef.current = null;
        }

        // localStorage 제거 (질문 동일해도 삭제)
        try {
          const currentStorageKey = `poll-voted-${config?.question || ""}`;
          localStorage.removeItem(currentStorageKey);
        } catch {}
      }
    } finally {
      setTimeout(() => setIsUpdating(false), 180);
    }
  }, [applyOptimisticFloor, config?.question, pendingChoice]);

  // ===== SSE + 폴백 =====
  const startFallbackPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(() => {
      if (!sseConnectedRef.current && !document.hidden) {
        fetchVotes();
      }
    }, 12000);
  }, [fetchVotes]);

  const stopFallbackPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const openSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const es = new EventSource("/api/vote/stream");
    sseRef.current = es;

    es.onopen = () => {
      sseConnectedRef.current = true;
      backoffAttemptRef.current = 0;
      stopFallbackPolling();
    };

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);

        if (payload.type === "vote_update") {
          // ★ SSE 값에도 하한선 적용
          const vRaw = payload.votes as VoteData;
          const v = applyOptimisticFloor(vRaw);
          setVotes(prev => (prev.A === v.A && prev.B === v.B ? prev : v));
          const newTotal = v.A + v.B;
          const newPercentA = newTotal ? Math.round((v.A / newTotal) * 100) : 0;
          const newPercentB = newTotal ? 100 - newPercentA : 0;
          setAnimatedVotesA(v.A);
          setAnimatedVotesB(v.B);
          setAnimatedTotal(newTotal);
          setAnimatedPercentA(newPercentA);
          setAnimatedPercentB(newPercentB);
          setSynced(true);
        }

        if (payload.type === "config_update" && payload.config) {
          if (JSON.stringify(payload.config) !== JSON.stringify(config)) {
            setConfig(payload.config);
          }
        }
      } catch {}
    };

    es.onerror = () => {
      sseConnectedRef.current = false;
      es.close();

      const attempt = backoffAttemptRef.current++;
      const base = 800;
      const max = 6000;
      const delay = Math.min(base * Math.pow(2, attempt), max);

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        startFallbackPolling();
        openSSE();
      }, delay);
    };
  }, [applyOptimisticFloor, config, startFallbackPolling, stopFallbackPolling]);

  // 마운트 & 복귀 이벤트
  useEffect(() => {
    openSSE();

    const onVisible = () => {
      if (!document.hidden) {
        fetchVotes();
        if (!sseConnectedRef.current) startFallbackPolling();
      } else {
        stopFallbackPolling();
      }
    };
    const onFocus = () => fetchVotes();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted || (document as any).wasDiscarded) fetchVotes();
    };
    const onOnline = () => fetchVotes();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow as any);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow as any);
      window.removeEventListener("online", onOnline);

      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      stopFallbackPolling();
    };
  }, [openSSE, fetchVotes, startFallbackPolling, stopFallbackPolling]);

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

    // ★ 질문이 바뀌면 하한선도 리셋
    optimisticFloorRef.current = null;
    if (clearOptimisticTimerRef.current) {
      clearTimeout(clearOptimisticTimerRef.current);
      clearOptimisticTimerRef.current = null;
    }

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
    if (showResult) return; // 이미 투표한 경우
    
    navigator.vibrate?.(20);
    
    // 즉시 UI 업데이트 (낙관적 업데이트)
    setSelected(choice);
    setShowResult(true);
    setNumbersVisible(true);
    hasVotedRef.current = choice;
    hasShownResultRef.current = true;
    
    // 낙관적 스냅샷으로 즉시 +1 표시
    applyAnimatedSnapshot(votes, choice);
    
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
        // 서버 응답으로 실제 값 업데이트
        setVotes(data.votes);
        const tot = data.votes.A + data.votes.B;
        const pA = tot ? Math.round((data.votes.A / tot) * 100) : 0;
        const pB = tot ? 100 - pA : 0;
        setAnimatedVotesA(data.votes.A);
        setAnimatedVotesB(data.votes.B);
        setAnimatedTotal(tot);
        setAnimatedPercentA(pA);
        setAnimatedPercentB(pB);
        
        // localStorage 저장
        try {
          localStorage.setItem(storageKey, JSON.stringify({ selected: choice }));
        } catch {}
        
        // 다른 탭 동기화
        try {
          if (!bcRef.current) bcRef.current = new BroadcastChannel("poll_channel");
          bcRef.current.postMessage({ type: "vote_update_hint" });
        } catch {}
      }
    } catch (error) {
      console.error("투표 실패:", error);
      alert("투표에 실패했습니다. 다시 시도해주세요.");
      // 실패 시 초기화
      setSelected(null);
      setShowResult(false);
      setNumbersVisible(false);
      hasVotedRef.current = null;
      hasShownResultRef.current = false;
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
      <div className="w-full max-w-4xl flex flex-col items-center gap-12 sm:gap-16 md:gap-20 transition-all duration-700 ease-out">
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
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isAActive ? "scale-110" : ""}`}>
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
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isBActive ? "scale-110" : ""}`}>
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

        <div className={`text-center transition-opacity duration-200 ${canShowStats ? "opacity-100" : "opacity-0"} pointer-events-none`}>
          <p className="text-sm text-gray-400">
            총 <span className="inline-block">{animatedTotal.toLocaleString()}</span>명 참여
          </p>
          <Link href="/history" className="inline-block mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors pointer-events-auto">
            이전 설문 결과 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
