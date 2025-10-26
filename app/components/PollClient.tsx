"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";

// 투표 설정 타입 (질문과 선택지)
type TwoChoicePollConfig = {
  question: string;
  left: { label: string; emoji?: string };
  right: { label: string; emoji?: string };
};

// 투표 데이터 타입 (A, B 선택지의 투표 수)
type VoteData = { A: number; B: number };

/**
 * 투표 클라이언트 컴포넌트
 * - 실시간 투표 결과 표시
 * - SSE + 폴백 폴링으로 실시간 업데이트
 * - 애니메이션과 사용자 경험 최적화
 */
export default function PollClient({
  initialConfig,
  initialVotes,
}: {
  initialConfig: TwoChoicePollConfig | null;
  initialVotes: VoteData;
}) {
  // ===== 기본 상태 관리 =====
  const [config, setConfig] = useState<TwoChoicePollConfig | null>(initialConfig); // 현재 투표 설정
  const [votes, setVotes] = useState<VoteData>(initialVotes); // 서버에서 받은 투표 수
  const [selected, setSelected] = useState<"A" | "B" | null>(null); // 사용자가 선택한 옵션
  const [pendingChoice, setPendingChoice] = useState<"A" | "B" | null>(null); // 투표 중인 상태 (깜빡임 방지)
  const [showResult, setShowResult] = useState(false); // 결과 화면 표시 여부
  const [synced, setSynced] = useState(false); // 서버와 동기화 완료 여부
  const [isVisible, setIsVisible] = useState(false); // 카드 등장 애니메이션
  const [isUpdating, setIsUpdating] = useState(false); // 업데이트 중 상태

  // ===== 애니메이션 상태 관리 =====
  // SSR과 일치시키기 위해 initialVotes로 초기화 (Hydration 오류 방지)
  const [animatedPercentA, setAnimatedPercentA] = useState(() => {
    const total = initialVotes.A + initialVotes.B;
    return total > 0 ? Math.round((initialVotes.A / total) * 100) : 0;
  }); // A 선택지 퍼센트 (애니메이션용)
  const [animatedPercentB, setAnimatedPercentB] = useState(() => {
    const total = initialVotes.A + initialVotes.B;
    return total > 0 ? Math.round((initialVotes.B / total) * 100) : 0;
  }); // B 선택지 퍼센트 (애니메이션용)
  const [animatedVotesA, setAnimatedVotesA] = useState(initialVotes.A); // A 선택지 투표 수 (애니메이션용)
  const [animatedVotesB, setAnimatedVotesB] = useState(initialVotes.B); // B 선택지 투표 수 (애니메이션용)
  const [animatedTotal, setAnimatedTotal] = useState(initialVotes.A + initialVotes.B); // 총 투표 수 (애니메이션용)

  // 이전 값들 (애니메이션 시작점으로 사용)
  const [previousTotal, setPreviousTotal] = useState(0);
  const [previousPercentA, setPreviousPercentA] = useState(0);
  const [previousPercentB, setPreviousPercentB] = useState(0);
  const [previousVotesA, setPreviousVotesA] = useState(0);
  const [previousVotesB, setPreviousVotesB] = useState(0);

  // UI 효과 상태
  const [questionKey, setQuestionKey] = useState(0); // 질문 변경 감지용 (애니메이션 트리거)
  const [voteEffect, setVoteEffect] = useState<"A" | "B" | null>(null); // 투표 효과 (팝업 애니메이션)

  // ===== DOM 레퍼런스 =====
  const cardRef = useRef<HTMLDivElement>(null); // 카드 요소 참조

  // ===== SSE 및 폴링 관련 레퍼런스 =====
  const sseRef = useRef<EventSource | null>(null); // SSE 연결 객체
  const sseConnectedRef = useRef(false); // SSE 연결 상태
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 재연결 타이머
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null); // 폴링 타이머
  const backoffAttemptRef = useRef(0); // 재연결 시도 횟수

  // ===== 브로드캐스트 채널 =====
  const bcRef = useRef<BroadcastChannel | null>(null); // 관리자 페이지 변경 알림용

  // ===== 계산된 값들 =====
  const storageKey = useMemo(
    () => `poll-voted-${config?.question || ""}`,
    [config?.question]
  ); // localStorage 키 (질문별로 고유)

  const total = (votes?.A || 0) + (votes?.B || 0); // 총 투표 수
  const percentA = total > 0 ? Math.round(((votes?.A || 0) / total) * 100) : 0; // A 선택지 퍼센트
  const percentB = total > 0 ? Math.round(((votes?.B || 0) / total) * 100) : 0; // B 선택지 퍼센트

  // 버튼 활성화 상태 (깜빡임 방지용)
  const isAActive = selected === "A" || pendingChoice === "A"; // A 버튼이 활성화된 상태
  const isBActive = selected === "B" || pendingChoice === "B"; // B 버튼이 활성화된 상태

  // ===== 애니메이션 함수들 =====
  
  // 카드 등장 애니메이션 (페이지 로드 시)
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  /**
   * 부드러운 숫자 변경 애니메이션
   * @param previous 이전 값
   * @param current 목표 값
   * @param setter 상태 업데이트 함수
   */
  const animateDigitChange = (previous: number, current: number, setter: (value: number) => void) => {
    if (previous === current) return; // 값이 같으면 애니메이션 생략
    const duration = 600; // 애니메이션 지속 시간 (0.6초)
    const startTime = performance.now();
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1); // 0~1 사이의 진행률
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic 이징 함수
      setter(Math.round(previous + (current - previous) * eased));
      if (progress < 1) requestAnimationFrame(animate); // 애니메이션 계속
    };
    requestAnimationFrame(animate);
  };

  /**
   * 즉시 스냅샷 적용 (투표 시 0 깜빡임 제거)
   * 사용자가 투표할 때 서버 응답을 기다리지 않고 즉시 UI에 반영
   * @param base 현재 투표 수
   * @param extra 추가할 투표 (사용자가 선택한 옵션)
   */
  const applyAnimatedSnapshot = useCallback((base: VoteData, extra?: "A" | "B") => {
    const nextA = base.A + (extra === "A" ? 1 : 0); // A 선택지에 내 투표 추가
    const nextB = base.B + (extra === "B" ? 1 : 0); // B 선택지에 내 투표 추가
    const nextTotal = nextA + nextB; // 총 투표 수
    const nextPercentA = nextTotal ? Math.round((nextA / nextTotal) * 100) : 0; // A 퍼센트
    const nextPercentB = nextTotal ? 100 - nextPercentA : 0; // B 퍼센트

    // 애니메이션 상태 즉시 업데이트
    setAnimatedVotesA(nextA);
    setAnimatedVotesB(nextB);
    setAnimatedTotal(nextTotal);
    setAnimatedPercentA(nextPercentA);
    setAnimatedPercentB(nextPercentB);

    // 다음 애니메이션을 위한 기준값 설정
    setPreviousVotesA(nextA);
    setPreviousVotesB(nextB);
    setPreviousTotal(nextTotal);
    setPreviousPercentA(nextPercentA);
    setPreviousPercentB(nextPercentB);
  }, []);

  /**
   * 첫 결과 표시 시 카운팅 애니메이션
   * - 투표하지 않은 사용자가 결과를 볼 때만 실행
   * - 이미 투표한 사용자는 애니메이션 없이 즉시 표시
   */
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
      
      // 0에서 실제 값까지 카운팅 애니메이션
      const duration = 1500; // 1.5초 동안 애니메이션
      const startTime = performance.now();

      const animateValue = (start: number, end: number, setter: (n: number) => void) => {
        const step = (time: number) => {
          const elapsed = time - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          setter(Math.round(start + (end - start) * eased));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };

      // 모든 값들을 0에서 실제 값까지 애니메이션
      animateValue(0, percentA, setAnimatedPercentA);
      animateValue(0, percentB, setAnimatedPercentB);
      animateValue(0, votes?.A || 0, setAnimatedVotesA);
      animateValue(0, votes?.B || 0, setAnimatedVotesB);
      animateValue(0, total, setAnimatedTotal);

      // 애니메이션 완료 후 이전 값들 저장
      setPreviousPercentA(percentA);
      setPreviousPercentB(percentB);
      setPreviousVotesA(votes?.A || 0);
      setPreviousVotesB(votes?.B || 0);
      setPreviousTotal(total);
    }
  }, [showResult, synced, previousPercentA, selected, percentA, percentB, votes?.A, votes?.B, total]);

  /**
   * 이후 업데이트는 변화분만 애니메이션
   * - 첫 로드 후 다른 사용자가 투표할 때 실행
   * - 변경된 값만 개별적으로 애니메이션
   */
  useEffect(() => {
    if (showResult && synced && previousPercentA > 0) {
      // A 퍼센트가 변경된 경우
      if (percentA !== previousPercentA) {
        animateDigitChange(previousPercentA, percentA, setAnimatedPercentA);
        setPreviousPercentA(percentA);
      }
      // B 퍼센트가 변경된 경우
      if (percentB !== previousPercentB) {
        animateDigitChange(previousPercentB, percentB, setAnimatedPercentB);
        setPreviousPercentB(percentB);
      }
      // A 투표 수가 변경된 경우
      if ((votes?.A || 0) !== previousVotesA) {
        animateDigitChange(previousVotesA, votes?.A || 0, setAnimatedVotesA);
        setPreviousVotesA(votes?.A || 0);
      }
      // B 투표 수가 변경된 경우
      if ((votes?.B || 0) !== previousVotesB) {
        animateDigitChange(previousVotesB, votes?.B || 0, setAnimatedVotesB);
        setPreviousVotesB(votes?.B || 0);
      }
      // 총 투표 수가 변경된 경우
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

  // ===== 서버 통신 함수들 =====
  
  /**
   * 서버에서 투표 데이터 가져오기
   * - 현재 투표 수와 사용자의 투표 상태를 가져옴
   * - localStorage와 서버 상태를 동기화
   */
  const fetchVotes = useCallback(async () => {
    try {
      setIsUpdating(true);
      const res = await fetch("/api/vote", { cache: "no-store" });
      const data = await res.json();
      
      if (data?.success) {
        setVotes(data.votes); // 서버에서 받은 투표 수 업데이트
        setSynced(true); // 서버와 동기화 완료

        if (data.userVote) {
          // 사용자가 이미 투표한 경우
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

          // localStorage에 투표 정보 저장
          try {
            const currentStorageKey = `poll-voted-${config?.question || ""}`;
            localStorage.setItem(currentStorageKey, JSON.stringify({ selected: data.userVote }));
          } catch {}
        } else {
          // 사용자가 투표하지 않은 경우
          if ((selected || showResult) && !pendingChoice) {
            setSelected(null);
            setShowResult(false);
            setSynced(false);
          }
          // localStorage에서 투표 정보 제거
          try {
            const currentStorageKey = `poll-voted-${config?.question || ""}`;
            localStorage.removeItem(currentStorageKey);
          } catch {}
        }
      }
    } catch {
      // 네트워크 불안정은 폴링/재연결로 커버
    } finally {
      setTimeout(() => setIsUpdating(false), 200);
    }
  }, [config?.question, pendingChoice, selected, showResult]);

  // ===== SSE 및 폴링 관리 함수들 =====
  
  /**
   * 폴백 폴링 시작
   * - SSE 연결이 끊어졌을 때 12초마다 서버 상태 확인
   * - 탭이 숨겨진 상태에서는 폴링 중단 (배터리 절약)
   */
  const startFallbackPolling = useCallback(() => {
    if (pollIntervalRef.current) return; // 이미 동작 중이면 중복 실행 방지
    pollIntervalRef.current = setInterval(() => {
      if (!sseConnectedRef.current && !document.hidden) {
        fetchVotes(); // SSE가 연결되지 않고 탭이 보이는 상태에서만 폴링
      }
    }, 12000); // 12초마다 폴링
  }, [fetchVotes]);

  /**
   * 폴백 폴링 중지
   * - SSE 연결이 복구되거나 컴포넌트 언마운트 시 호출
   */
  const stopFallbackPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * SSE 연결 열기
   * - 실시간 투표 업데이트를 위한 Server-Sent Events 연결
   * - 자동 재연결 및 백오프 전략 포함
   */
  const openSSE = useCallback(() => {
    // 기존 연결이 있으면 정리
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    
    const es = new EventSource("/api/vote/stream");
    sseRef.current = es;

    // SSE 연결 성공 시
    es.onopen = () => {
      sseConnectedRef.current = true;
      backoffAttemptRef.current = 0; // 재연결 시도 횟수 리셋
      stopFallbackPolling(); // SSE 연결되면 폴백 폴링 중지
    };

    // SSE 메시지 수신 시
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        
        if (payload.type === "vote_update") {
          // 투표 업데이트 메시지 처리
          const v = payload.votes as VoteData;
          setVotes(prev => (prev.A === v.A && prev.B === v.B ? prev : v)); // 변경된 경우에만 업데이트
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
          // 설정 업데이트 메시지 처리 (관리자가 질문 변경 시)
          if (JSON.stringify(payload.config) !== JSON.stringify(config)) {
            setConfig(payload.config);
            fetchVotes();
          }
        }
      } catch {}
    };

    // SSE 연결 오류 시
    es.onerror = () => {
      sseConnectedRef.current = false;
      es.close();
      
      // 지수 백오프로 재연결 시도
      const attempt = backoffAttemptRef.current++;
      const base = 800; // 기본 지연 시간 (0.8초)
      const max = 6000; // 최대 지연 시간 (6초)
      const delay = Math.min(base * Math.pow(2, attempt), max);
      
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        startFallbackPolling(); // 연결 안 된 동안 폴링 시작
        openSSE(); // 재연결 시도
      }, delay);
    };
  }, [config, fetchVotes, startFallbackPolling, stopFallbackPolling]);

  // 마운트 시 SSE 연결 + 가시성/포커스/온라인/페이지복귀 훅
  useEffect(() => {
    openSSE();

    const onVisibleOrFocus = () => {
      if (!document.hidden) {
        fetchVotes();
        if (!sseConnectedRef.current) startFallbackPolling();
      } else {
        // 숨김 상태: 불필요 폴링은 잠시 중단
        stopFallbackPolling();
      }
    };
    const onPageShow = () => {
      fetchVotes();
      if (!sseConnectedRef.current) startFallbackPolling();
    };
    const onOnline = () => {
      fetchVotes();
      if (!sseConnectedRef.current) startFallbackPolling();
    };

    document.addEventListener("visibilitychange", onVisibleOrFocus);
    window.addEventListener("focus", onVisibleOrFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibleOrFocus);
      window.removeEventListener("focus", onVisibleOrFocus);
      window.removeEventListener("pageshow", onPageShow);
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
    applyAnimatedSnapshot(votes, choice);
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

        // ✅ 다른 탭/창에 "투표됨" 힌트 브로드캐스트 → 즉시 갱신 유도
        try {
          if (!bcRef.current) bcRef.current = new BroadcastChannel("poll_channel");
          bcRef.current.postMessage({ type: "vote_update_hint" });
        } catch {}
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

  // 브로드캐스트 수신(설정 변경 + 투표 힌트)
  useEffect(() => {
    const bc = new BroadcastChannel("poll_channel");
    bcRef.current = bc;

    bc.onmessage = (event) => {
      if (event.data.type === "config_update") {
        forceRefreshConfig();
      }
      if (event.data.type === "vote_update_hint") {
        // 다른 탭에서 투표 발생 → 즉시 동기화
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
