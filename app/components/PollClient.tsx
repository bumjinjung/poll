"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

const ANIM_MS = 1000; // 투표 시 애니메이션 시간 (천천히)
const REVEAL_DELAY = 0; // 즉시 표시

// 쿠키에서 특정 값 읽기
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

type TwoChoicePollConfig = {
  id: string;
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
  // 쿠키 확인 - 투표한 사용자면 optimistic하게 결과 표시
  const hasUserCookie = getCookie('poll_user_id') !== null;
  
  // ===== 기본 상태 =====
  const [config, setConfig] = useState<TwoChoicePollConfig | null>(initialConfig);
  const [votes, setVotes] = useState<VoteData>(initialVotes);
  const [selected, setSelected] = useState<"A" | "B" | null>(null);
  const [showResult, setShowResult] = useState(hasUserCookie);
  const [synced, setSynced] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // ===== 애니메이션 제어 =====
  const [animationKey, setAnimationKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [numbersOpacity, setNumbersOpacity] = useState(hasUserCookie ? 1 : 0);

  // 애니메이션용 숫자
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

  const [questionKey, setQuestionKey] = useState(0);
  const [voteEffect, setVoteEffect] = useState<"A" | "B" | null>(null);

  // Refs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const hasShownResultRef = useRef(hasUserCookie);
  const hasVotedRef = useRef<"A" | "B" | null>(null);
  const isVotingInProgressRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const prevQuestionRef = useRef<string | null>(null);
  const senderIdRef = useRef<string>(crypto.randomUUID()); // 자신의 메시지 구분용
  const latestVotesRef = useRef(votes); // 최신 votes 값 저장

  // 최신 votes 값 동기화
  useEffect(() => { 
    latestVotesRef.current = votes; 
  }, [votes]);

  // 파생값
  const isAActive = selected === "A";
  const isBActive = selected === "B";
  const canShowStats = showResult;

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

  // ===== 애니메이션 완료 핸들러 (개선됨) =====
  const handleAnimationEnd = useCallback((e?: React.AnimationEvent<HTMLDivElement>) => {
    // 이 엘리먼트 자신에게서 발생한 이벤트만
    if (e && e.currentTarget !== e.target) return;
    // 정확히 fillUp만 처리
    // (Tailwind 등에서 다른 animation이 섞일 가능성 방지)
    // @ts-ignore
    if (e?.animationName && e.animationName !== "fillUp") return;

    setIsAnimating(false);
    isVotingInProgressRef.current = false;
  }, []);

  // ===== 서버 통신 (deps 안정화) =====
  const fetchVotesAndConfig = useCallback(async () => {
    if (isVotingInProgressRef.current) return;
    
    try {
      setIsUpdating(true);
      
      const res = await fetch("/api/vote", { cache: "no-store" });
      const data = await res.json();
      if (!data?.success) return;

      const v = data.votes;
      const prev = latestVotesRef.current;
      const voteChanged = prev.A !== v.A || prev.B !== v.B;
      
      setVotes(v); // 이후 latestVotesRef가 업데이트됨
      setSynced(true);

      // 애니메이션 값 업데이트
      const newTotal = v.A + v.B;
      const newPercentA = newTotal ? Math.round((v.A / newTotal) * 100) : 0;
      const newPercentB = newTotal ? 100 - newPercentA : 0;
      
      if (voteChanged) {
        // 폴링으로 값이 변경되면 카운팅 애니메이션 실행
        animateDigitChange(animatedVotesA, v.A, setAnimatedVotesA);
        animateDigitChange(animatedVotesB, v.B, setAnimatedVotesB);
        animateDigitChange(animatedTotal, newTotal, setAnimatedTotal);
        animateDigitChange(animatedPercentA, newPercentA, setAnimatedPercentA);
        animateDigitChange(animatedPercentB, newPercentB, setAnimatedPercentB);
      } else if (animatedTotal === 0) {
        // 첫 로드는 즉시 값 설정 (애니메이션 없음)
        setAnimatedVotesA(v.A);
        setAnimatedVotesB(v.B);
        setAnimatedTotal(newTotal);
        setAnimatedPercentA(newPercentA);
        setAnimatedPercentB(newPercentB);
      }

      if (data.userVote) {
        hasVotedRef.current = data.userVote;
        setSelected(data.userVote);

        if (!hasShownResultRef.current) {
          setShowResult(true);
          hasShownResultRef.current = true;
          setNumbersOpacity(0);
          setTimeout(() => setNumbersOpacity(1), REVEAL_DELAY);
        } else {
          setShowResult(true);
          setNumbersOpacity(1);
        }
      } else {
        hasVotedRef.current = null;
        hasShownResultRef.current = false;
        setSelected(null);
        setShowResult(false);
        setSynced(false);
        setNumbersOpacity(0);
      }
    } finally {
      setTimeout(() => setIsUpdating(false), 180);
    }
  }, []); // deps 비움 - latestVotesRef로 최신 값 참조

  // ===== 5초 간격 폴링 =====
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      if (isVotingInProgressRef.current) return;
      fetchVotesAndConfig();
    };
    
    tick(); // 초기 로드
    pollIntervalRef.current = setInterval(tick, 5000);

    // 이벤트 리스너
    const onFocus = () => tick();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted || (document as any).wasDiscarded) tick();
    };
    const onOnline = () => tick();

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
  }, [fetchVotesAndConfig]);

  // showResult가 열린 "그 순간"만 숫자 공개 연출
  useEffect(() => {
    if (showResult && !hasShownResultRef.current) {
      hasShownResultRef.current = true;
      setNumbersOpacity(0);
      const t = setTimeout(() => setNumbersOpacity(1), REVEAL_DELAY);
      return () => clearTimeout(t);
    }
  }, [showResult]);

  // 질문 변경 시 초기화
  useEffect(() => {
    if (!config) return;
    const prevQ = prevQuestionRef.current;
    if (prevQ && prevQ !== config.question) {
      prevQuestionRef.current = config.question;
      setQuestionKey((k) => k + 1);

      setAnimatedPercentA(0);
      setAnimatedPercentB(0);
      setAnimatedVotesA(0);
      setAnimatedVotesB(0);
      setAnimatedTotal(0);
      setSynced(false);

      setShowResult(false);
      hasShownResultRef.current = false;
      hasVotedRef.current = null;
      setNumbersOpacity(0);
      hasInitializedRef.current = false;
      setAnimationKey(0);
      setIsAnimating(false);

      fetchVotesAndConfig();
    } else if (!prevQuestionRef.current) {
      prevQuestionRef.current = config.question;
    }
  }, [config?.question, fetchVotesAndConfig]);

  // 서버에서만 투표 상태 확인 (최초 진입만)
  useEffect(() => {
    if (!config?.question || hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    fetchVotesAndConfig();
  }, [config?.question, fetchVotesAndConfig]);

  // 투표 처리
  const handleVote = async (choice: "A" | "B") => {
    if (showResult) return;
    
    navigator.vibrate?.(20);
    
    // 애니메이션 진행 중 플래그 설정
    isVotingInProgressRef.current = true;
    setIsAnimating(true);
    
    // 투표 직후 UI 세팅
    setSelected(choice);
    setShowResult(true);
    setAnimationKey(prev => prev + 1);
    setNumbersOpacity(0);
    
    // 투표 효과
    setVoteEffect(choice);
    setTimeout(() => setVoteEffect(null), ANIM_MS);

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const data = await res.json();
      
      if (data.success && data.votes) {
        // 서버 응답으로 상태 업데이트
        setVotes(data.votes);
        setSelected(choice);
        hasVotedRef.current = choice;
        hasShownResultRef.current = true;
        
        // 새로운 값 계산
        const tot = data.votes.A + data.votes.B;
        const pA = tot ? Math.round((data.votes.A / tot) * 100) : 0;
        const pB = tot ? 100 - pA : 0;
        
        // 투표 시에는 카운팅 애니메이션 없이 즉시 최종 값으로 설정
        setAnimatedVotesA(data.votes.A);
        setAnimatedVotesB(data.votes.B);
        setAnimatedTotal(tot);
        setAnimatedPercentA(pA);
        setAnimatedPercentB(pB);
        
        // 숫자는 애니메이션과 동시에 표시
        setNumbersOpacity(1);
        
        try {
          if (!bcRef.current) bcRef.current = new BroadcastChannel("poll_channel");
          bcRef.current.postMessage({ type: "vote_update_hint", sender: senderIdRef.current });
        } catch {}
      } else {
        throw new Error("Server returned unsuccessful response");
      }
    } catch (error) {
      console.error("투표 실패:", error);
      
      // 실패 시 초기화
      setSelected(null);
      setShowResult(false);
      setNumbersOpacity(0);
      hasVotedRef.current = null;
      hasShownResultRef.current = false;
      setIsAnimating(false);
      isVotingInProgressRef.current = false;
      
      // 서버 상태 확인
      fetchVotesAndConfig();
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
      if (isVotingInProgressRef.current) return;
      if (event?.data?.sender === senderIdRef.current) return; // 자기것 무시
      
      if (event.data.type === "config_update") forceRefreshConfig();
      if (event.data.type === "vote_update_hint") fetchVotesAndConfig();
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
  }, [forceRefreshConfig, fetchVotesAndConfig]);

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
            {isAActive && <div className="absolute inset-0 z-[3] bg-black/5 md:backdrop-blur-[1px] pointer-events-none" />}
            {isAActive && (
              <div
                className="absolute inset-0 z-[3] pointer-events-none"
                style={{ background: "conic-gradient(from 0deg, transparent, rgba(37,99,235,.3), transparent)", borderRadius: "inherit" }}
              >
                <div className="animate-ringSweep w-full h-full" />
              </div>
            )}
            
            {/* 배경 */}
            <div className="absolute inset-0 z-0 bg-neutral-50" />
            
            {/* hover 효과 */}
            {!showResult && (
              <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden bg-gradient-to-br from-blue-400/40 to-blue-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
            
            {/* 선택된 색상 오버레이 */}
            {isAActive && (
              <div
                key={animationKey}
                className="absolute inset-0 z-[2] bg-gradient-to-br from-blue-500 to-blue-600"
                style={
                  isAnimating
                    ? { animation: `fillUp ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`, transformOrigin: 'bottom' }
                    : { opacity: 1 }
                }
                onAnimationEnd={handleAnimationEnd}
              />
            )}
            
            <div className="relative z-[10] h-full flex flex-col items-center p-3 sm:p-4 gap-1 sm:gap-2 justify-center">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isAActive ? "scale-110 animate-emojiBounce" : ""}`}>
                {config.left.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold ${isAActive ? "text-white" : "text-gray-800"}`}>
                {config.left.label}
              </div>
              {showResult && (
                <div 
                  className={`transition-opacity duration-300 ${isAActive ? "text-white" : "text-gray-900"}`}
                  style={{ opacity: numbersOpacity }}
                >
                  <div className="text-xl sm:text-2xl font-bold mb-0.5">{animatedPercentA}%</div>
                  <div className={`text-xs ${isAActive ? "text-blue-100" : "text-gray-600"}`}>{animatedVotesA.toLocaleString()} votes</div>
                </div>
              )}
            </div>
            
            {isAActive && <div className="absolute inset-0 z-[4] ring-4 ring-blue-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none" />}
            {voteEffect === "A" && (
              <div
                className="absolute inset-0 z-[5] rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(59,130,246,.3) 0%, transparent 70%)", animation: `votePopEffect ${ANIM_MS}ms ease-out forwards` }}
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
            {isBActive && <div className="absolute inset-0 z-[3] bg-black/5 md:backdrop-blur-[1px] pointer-events-none" />}
            {isBActive && (
              <div
                className="absolute inset-0 z-[3] pointer-events-none"
                style={{ background: "conic-gradient(from 0deg, transparent, rgba(147,51,234,.3), transparent)", borderRadius: "inherit" }}
              >
                <div className="animate-ringSweep w-full h-full" />
              </div>
            )}
            
            {/* 배경 */}
            <div className="absolute inset-0 z-0 bg-neutral-50" />
            
            {/* hover 효과 */}
            {!showResult && (
              <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden bg-gradient-to-br from-purple-400/40 to-purple-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
            
            {/* 선택된 색상 오버레이 */}
            {isBActive && (
              <div
                key={animationKey}
                className="absolute inset-0 z-[2] bg-gradient-to-br from-purple-500 to-purple-600"
                style={
                  isAnimating
                    ? { animation: `fillUp ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`, transformOrigin: 'bottom' }
                    : { opacity: 1 }
                }
                onAnimationEnd={handleAnimationEnd}
              />
            )}
            
            <div className="relative z-[10] h-full flex flex-col items-center p-3 sm:p-4 gap-1 sm:gap-2 justify-center">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isBActive ? "scale-110 animate-emojiBounce" : ""}`}>
                {config.right.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold ${isBActive ? "text-white" : "text-gray-800"}`}>
                {config.right.label}
              </div>
              {showResult && (
                <div 
                  className={`transition-opacity duration-300 ${isBActive ? "text-white" : "text-gray-900"}`}
                  style={{ opacity: numbersOpacity }}
                >
                  <div className="text-xl sm:text-2xl font-bold mb-0.5">{animatedPercentB}%</div>
                  <div className={`text-xs ${isBActive ? "text-purple-100" : "text-gray-600"}`}>{animatedVotesB.toLocaleString()} votes</div>
                </div>
              )}
            </div>
            
            {isBActive && <div className="absolute inset-0 z-[4] ring-4 ring-purple-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none" />}
            {voteEffect === "B" && (
              <div
                className="absolute inset-0 z-[5] rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(147,51,234,.3) 0%, transparent 70%)", animation: `votePopEffect ${ANIM_MS}ms ease-out forwards` }}
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
