"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  const [pendingChoice, setPendingChoice] = useState<"A" | "B" | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [synced, setSynced] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // 애니메이션 숫자들(SSR과 일치시키기 위해 initialVotes로 초기화)
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

  const [previousTotal, setPreviousTotal] = useState(0);
  const [previousPercentA, setPreviousPercentA] = useState(0);
  const [previousPercentB, setPreviousPercentB] = useState(0);
  const [previousVotesA, setPreviousVotesA] = useState(0);
  const [previousVotesB, setPreviousVotesB] = useState(0);

  const [questionKey, setQuestionKey] = useState(0);
  const [voteEffect, setVoteEffect] = useState<"A" | "B" | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  // SSE 상태 & 폴링 타이머 레퍼런스
  const sseRef = useRef<EventSource | null>(null);
  const sseConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffAttemptRef = useRef(0);

  const storageKey = useMemo(
    () => `poll-voted-${config?.question || ""}`,
    [config?.question]
  );

  const total = (votes?.A || 0) + (votes?.B || 0);
  const percentA = total > 0 ? Math.round(((votes?.A || 0) / total) * 100) : 0;
  const percentB = total > 0 ? Math.round(((votes?.B || 0) / total) * 100) : 0;

  const isAActive = selected === "A" || pendingChoice === "A";
  const isBActive = selected === "B" || pendingChoice === "B";

  // 등장 애니메이션
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // 부드러운 숫자 변경
  const animateDigitChange = (previous: number, current: number, setter: (value: number) => void) => {
    if (previous === current) return;
    const duration = 600;
    const startTime = performance.now();
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setter(Math.round(previous + (current - previous) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  };

  // 즉시 스냅샷(내 표 1 포함)으로 0 깜빡임 제거
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

  // 첫 결과 표시 시 카운팅 애니메이션(투표 안했을 때만)
  useEffect(() => {
    if (showResult && synced && previousPercentA === 0) {
      if (selected) {
        // 이미 내 표가 반영된 상태면 애니메이션 없이 이전값만 세팅
        setPreviousPercentA(percentA);
        setPreviousPercentB(percentB);
        setPreviousVotesA(votes?.A || 0);
        setPreviousVotesB(votes?.B || 0);
        setPreviousTotal(total);
        return;
      }
      const duration = 1500;
      const startTime = performance.now();

      const animateValue = (start: number, end: number, setter: (n: number) => void) => {
        const step = (time: number) => {
          const elapsed = time - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setter(Math.round(start + (end - start) * eased));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };

      animateValue(0, percentA, setAnimatedPercentA);
      animateValue(0, percentB, setAnimatedPercentB);
      animateValue(0, votes?.A || 0, setAnimatedVotesA);
      animateValue(0, votes?.B || 0, setAnimatedVotesB);
      animateValue(0, total, setAnimatedTotal);

      setPreviousPercentA(percentA);
      setPreviousPercentB(percentB);
      setPreviousVotesA(votes?.A || 0);
      setPreviousVotesB(votes?.B || 0);
      setPreviousTotal(total);
    }
  }, [showResult, synced, previousPercentA, selected, percentA, percentB, votes?.A, votes?.B, total]);

  // 이후 업데이트는 변화분만 애니메이션
  useEffect(() => {
    if (showResult && synced && previousPercentA > 0) {
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
  }, [
    showResult, synced,
    percentA, percentB, votes?.A, votes?.B, total,
    previousPercentA, previousPercentB, previousVotesA, previousVotesB, previousTotal
  ]);

  // ===== 공용 fetchVotes =====
  const fetchVotes = useCallback(async () => {
    try {
      setIsUpdating(true);
      const res = await fetch("/api/vote", { cache: "no-store" });
      const data = await res.json();
      if (data?.success) {
        setVotes(data.votes);
        setSynced(true);

        if (data.userVote) {
          setSelected(data.userVote);
          setShowResult(true);

          // 화면 숫자도 즉시 맞춰줌(깜빡임 방지)
          const newTotal = data.votes.A + data.votes.B;
          const newPercentA = newTotal ? Math.round((data.votes.A / newTotal) * 100) : 0;
          const newPercentB = newTotal ? 100 - newPercentA : 0;
          setAnimatedVotesA(data.votes.A);
          setAnimatedVotesB(data.votes.B);
          setAnimatedTotal(newTotal);
          setAnimatedPercentA(newPercentA);
          setAnimatedPercentB(newPercentB);

          // 로컬스토리지 동기화 (클라에서만)
          try {
            const currentStorageKey = `poll-voted-${config?.question || ""}`;
            localStorage.setItem(currentStorageKey, JSON.stringify({ selected: data.userVote }));
          } catch {}
        } else {
          // 서버엔 투표 기록 없음
          if ((selected || showResult) && !pendingChoice) {
            setSelected(null);
            setShowResult(false);
            setSynced(false);
          }
          try {
            const currentStorageKey = `poll-voted-${config?.question || ""}`;
            localStorage.removeItem(currentStorageKey);
          } catch {}
        }
      }
    } catch {
      // 무시(폴링/재시도 등으로 커버)
    } finally {
      setTimeout(() => setIsUpdating(false), 200);
    }
  }, [config?.question, pendingChoice, selected, showResult]);

  // ===== SSE 연결 (기본) + 재연결 백오프 =====
  const openSSE = useCallback(() => {
    // 기존 연결 정리
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    const es = new EventSource("/api/vote/stream");
    sseRef.current = es;

    es.onopen = () => {
      sseConnectedRef.current = true;
      backoffAttemptRef.current = 0; // 성공 시 백오프 리셋
      // SSE 연결되면 폴백 폴링 중지
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "vote_update") {
          const v = payload.votes as VoteData;
          setVotes(prev => {
            if (prev.A === v.A && prev.B === v.B) return prev;
            return v;
          });
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
            fetchVotes();
          }
        }
      } catch {}
    };

    es.onerror = () => {
      sseConnectedRef.current = false;
      es.close();
      // 백오프 재연결
      const attempt = backoffAttemptRef.current++;
      const base = 800;
      const max = 6000;
      const delay = Math.min(base * Math.pow(2, attempt), max);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        // 폴백 폴링 가동(연결 안 된 동안만)
        startFallbackPolling();
        openSSE();
      }, delay);
    };
  }, [config, fetchVotes]);

  // ===== 폴백 폴링(12초) =====
  const startFallbackPolling = useCallback(() => {
    if (pollIntervalRef.current) return; // 이미 동작 중
    pollIntervalRef.current = setInterval(() => {
      if (!sseConnectedRef.current) {
        fetchVotes();
      }
    }, 12000); // 12초
  }, [fetchVotes]);

  // 마운트 시 SSE 연결 + 가시성 복구 fetch
  useEffect(() => {
    openSSE();

    const onVisibility = () => {
      if (!document.hidden) {
        // 탭 복귀 시 한 번 동기화
        fetchVotes();
        // 만약 SSE가 비정상 상태면 폴백 폴링을 보장
        if (!sseConnectedRef.current) startFallbackPolling();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [openSSE, fetchVotes, startFallbackPolling]);

  // 질문 바뀔 때 초기화 + 동기화
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

    fetchVotes();
  }, [config?.question, fetchVotes]);

  // 로컬 저장된 내 투표 빠른 반영(클라에서만)
  useEffect(() => {
    if (!config?.question) return;
    try {
      const raw = localStorage.getItem(`poll-voted-${config.question}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { selected?: "A" | "B" };
        if (parsed?.selected) {
          setSelected(parsed.selected);
          setShowResult(true);
          setSynced(false);
          fetchVotes(); // 서버와 동기화
          return;
        }
      }
    } catch {}
    setSelected(null);
    setShowResult(false);
    setSynced(false);
    fetchVotes();
  }, [config?.question, fetchVotes]);

  // 내 표 클릭(낙관적 갱신 + 서버 확인)
  const handleVote = async (choice: "A" | "B") => {
    if (showResult) return;
    navigator.vibrate?.(20);
    setPendingChoice(choice);
    setSelected(choice);
    applyAnimatedSnapshot(votes, choice); // 0 깜빡임 제거
    setShowResult(true);
    setSynced(false);

    setVoteEffect(choice);
    setTimeout(() => setVoteEffect(null), 600);

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const data = await res.json();
      if (data.success) {
        setVotes(data.votes);
        setSynced(true);
        try {
          localStorage.setItem(storageKey, JSON.stringify({ selected: choice }));
        } catch {}
        setPendingChoice(null);
      } else {
        setVotes(data.votes);
        setSynced(true);
        setPendingChoice(null);
      }
    } catch {
      alert("투표에 실패했습니다. 다시 시도해주세요.");
      setSelected(null);
      setShowResult(false);
      setPendingChoice(null);
    }
  };

  // 관리자 강제 리프레시
  const forceRefreshConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/today", { cache: "no-store" });
      const data = await res.json();
      if (data?.data) {
        setConfig(data.data);
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
      }
    } catch {}
  }, []);

  // 브로드캐스트 수신
  useEffect(() => {
    const bc = new BroadcastChannel("poll_channel");
    bc.onmessage = (event) => {
      if (event.data.type === "config_update") {
        forceRefreshConfig();
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
    };
  }, [forceRefreshConfig]);

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
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="text-center px-4">
          <h2
            key={questionKey}
            className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-800 animate-fade-in-slide-up"
            style={{ animation: "fadeInSlideUp 0.6s ease-out forwards" }}
          >
            {config.question}
          </h2>
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-4">
          {/* A 버튼 */}
          <button
            onClick={() => handleVote("A")}
            disabled={showResult}
            className={`
              group relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out
              ${showResult ? "cursor-default" : "cursor-pointer hover:scale-[1.05] active:scale-[0.98]"}
              ${isAActive ? "shadow-[0_20px_60px_rgba(37,99,235,0.35)] scale-[1.03]" : "shadow-lg"}
            `}
          >
            {isAActive && <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px] pointer-events-none" />}
            {isAActive && (
              <div className="absolute inset-0 pointer-events-none"
                   style={{ background: "conic-gradient(from 0deg, transparent, rgba(37, 99, 235, 0.3), transparent)", borderRadius: "inherit" }}>
                <div className="animate-ringSweep w-full h-full" />
              </div>
            )}
            {!showResult && (
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-blue-400/40 to-blue-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 hover-fill"
                style={{ transform: "scaleY(0)", transformOrigin: "bottom", transition: "opacity 0.3s ease, transform 0.6s ease-out" }}
              />
            )}
            <div
              className={`
                absolute inset-0 transition-all duration-500 origin-bottom
                ${isAActive ? "bg-gradient-to-br from-blue-500 to-blue-600 scale-y-100" : "bg-neutral-50 scale-y-0"}
              `}
              style={{ transform: isAActive ? "scaleY(1)" : "scaleY(0)", transformOrigin: "bottom center" }}
            />
            <div className="relative h-full flex flex-col items-center justify-center p-3 sm:p-4 gap-1 sm:gap-2">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isAActive ? "scale-110" : showResult ? "" : "group-hover:scale-105"}`}>
                {config.left.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold transition-colors ${isAActive ? "text-white" : "text-gray-800"}`}>
                {config.left.label}
              </div>
              {showResult && (
                <div className={`mt-1 sm:mt-2 animate-fadeIn ${isAActive ? "text-white" : "text-gray-900"}`}>
                  <div className="text-xl sm:text-2xl font-bold mb-0.5 transition-opacity duration-300" style={{ opacity: animatedPercentA > 0 ? 1 : 0 }}>
                    {animatedPercentA}%
                  </div>
                  <div className={`text-xs ${isAActive ? "text-blue-100" : "text-gray-600"}`}>{animatedVotesA.toLocaleString()} votes</div>
                </div>
              )}
            </div>
            {isAActive && <div className="absolute inset-0 ring-4 ring-blue-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem]" />}
            {voteEffect === "A" && (
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none"
                   style={{ background: "radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)", animation: "votePopEffect 0.6s ease-out forwards" }} />
            )}
          </button>

          {/* B 버튼 */}
          <button
            onClick={() => handleVote("B")}
            disabled={showResult}
            className={`
              group relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out
              ${showResult ? "cursor-default" : "cursor-pointer hover:scale-[1.05] active:scale-[0.98]"}
              ${isBActive ? "shadow-[0_20px_60px_rgba(147,51,234,0.35)] scale-[1.03]" : "shadow-lg"}
            `}
          >
            {isBActive && <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px] pointer-events-none" />}
            {isBActive && (
              <div className="absolute inset-0 pointer-events-none"
                   style={{ background: "conic-gradient(from 0deg, transparent, rgba(147, 51, 234, 0.3), transparent)", borderRadius: "inherit" }}>
                <div className="animate-ringSweep w-full h-full" />
              </div>
            )}
            {!showResult && (
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-purple-400/40 to-purple-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 hover-fill"
                style={{ transform: "scaleY(0)", transformOrigin: "bottom", transition: "opacity 0.3s ease, transform 0.6s ease-out" }}
              />
            )}
            <div
              className={`
                absolute inset-0 transition-all duration-500 origin-bottom
                ${isBActive ? "bg-gradient-to-br from-purple-500 to-purple-600 scale-y-100" : "bg-neutral-50 scale-y-0"}
              `}
              style={{ transform: isBActive ? "scaleY(1)" : "scaleY(0)", transformOrigin: "bottom center" }}
            />
            <div className="relative h-full flex flex-col items-center justify-center p-3 sm:p-4 gap-1 sm:gap-2">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isBActive ? "scale-110" : showResult ? "" : "group-hover:scale-105"}`}>
                {config.right.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold transition-colors ${isBActive ? "text-white" : "text-gray-800"}`}>
                {config.right.label}
              </div>
              {showResult && (
                <div className={`mt-1 sm:mt-2 animate-fadeIn ${isBActive ? "text-white" : "text-gray-900"}`}>
                  <div className="text-xl sm:text-2xl font-bold mb-0.5 transition-opacity duration-300" style={{ opacity: animatedPercentB > 0 ? 1 : 0 }}>
                    {animatedPercentB}%
                  </div>
                  <div className={`text-xs ${isBActive ? "text-purple-100" : "text-gray-600"}`}>{animatedVotesB.toLocaleString()} votes</div>
                </div>
              )}
            </div>
            {isBActive && <div className="absolute inset-0 ring-4 ring-purple-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem]" />}
            {voteEffect === "B" && (
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none"
                   style={{ background: "radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, transparent 70%)", animation: "votePopEffect 0.6s ease-out forwards" }} />
            )}
          </button>
        </div>

        <div className={`text-center transition-all duration-300 ${!showResult || !synced ? "invisible" : ""}`}>
          <p className="text-sm text-gray-400">
            총 <span className="inline-block">{animatedTotal.toLocaleString()}</span>명 참여
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
