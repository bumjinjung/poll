"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

const ANIM_MS = 1000; // 투표 시 애니메이션 시간 (천천히)
const REVEAL_DELAY = 0; // 즉시 표시

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
  initialUserVote,
}: {
  initialConfig: TwoChoicePollConfig | null;
  initialVotes: VoteData;
  initialUserVote: "A" | "B" | null;
}) {
  // ===== 기본 상태 =====
  const [config, setConfig] = useState<TwoChoicePollConfig | null>(initialConfig);
  const [votes, setVotes] = useState<VoteData>(initialVotes);
  const [selected, setSelected] = useState<"A" | "B" | null>(initialUserVote);
  const [showResult, setShowResult] = useState(initialUserVote !== null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasTomorrowPoll, setHasTomorrowPoll] = useState(false);

  // ===== 애니메이션 제어 =====
  const [numbersOpacity, setNumbersOpacity] = useState(initialUserVote !== null ? 1 : 0);

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

  const [supportsHover, setSupportsHover] = useState(true); // hover 지원 여부

  // Refs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const hasShownResultRef = useRef(initialUserVote !== null);
  const hasVotedRef = useRef<"A" | "B" | null>(initialUserVote);
  const isVotingInProgressRef = useRef(false);
  const isFetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const senderIdRef = useRef<string>(crypto.randomUUID()); // 자신의 메시지 구분용
  const latestVotesRef = useRef(votes); // 최신 votes 값 저장
  const animTokenRef = useRef(0); // 애니메이션 취소용 토큰
  const cooldownUntilRef = useRef(0); // 쿨다운 타임스탬프 (애니메이션 진행 중 fetch 차단용)
  
  // animatedVotes 값들의 최신 참조 (fetchVotesAndConfig에서 사용)
  const animARef = useRef(animatedVotesA);
  const animBRef = useRef(animatedVotesB);
  const animTotalRef = useRef(animatedTotal);
  const animPARef = useRef(animatedPercentA);
  const animPBRef = useRef(animatedPercentB);

  // 최신 votes 값 동기화
  useEffect(() => { 
    latestVotesRef.current = votes; 
  }, [votes]);

  // animatedVotes 값들의 최신 참조 동기화
  useEffect(() => { animARef.current = animatedVotesA; }, [animatedVotesA]);
  useEffect(() => { animBRef.current = animatedVotesB; }, [animatedVotesB]);
  useEffect(() => { animTotalRef.current = animatedTotal; }, [animatedTotal]);
  useEffect(() => { animPARef.current = animatedPercentA; }, [animatedPercentA]);
  useEffect(() => { animPBRef.current = animatedPercentB; }, [animatedPercentB]);

  // 파생값
  const isAActive = selected === "A";
  const isBActive = selected === "B";

  // ===== 등장 애니메이션 =====
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // ===== hover 지원 여부 체크 (모바일 안전화) =====
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(hover: hover)');
      setSupportsHover(mediaQuery.matches);
      
      const handleChange = (e: MediaQueryListEvent) => setSupportsHover(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  // ===== 모든 진행 중인 숫자 애니메이션 취소 =====
  const cancelAllAnimations = () => {
    animTokenRef.current++;
  };

  // ===== 숫자 애니메이션 유틸 =====
  const animateDigitChange = (from: number, to: number, setter: (n: number) => void) => {
    if (from === to) return;
    const token = animTokenRef.current;
    const start = performance.now();
    const step = (t: number) => {
      if (animTokenRef.current !== token) return; // 이전 애니메이션 즉시 중단
      const p = Math.min((t - start) / ANIM_MS, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setter(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };


  // ===== 서버 통신 (deps 안정화) =====
  const fetchVotesAndConfig = useCallback(async () => {
    // 쿨다운 중이면 즉시 return
    if (Date.now() < cooldownUntilRef.current) return;
    if (isVotingInProgressRef.current || isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    try {
      const res = await fetch(`/api/vote?pollId=${config?.id ?? ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.success) return;

      // config 업데이트 (null일 수 있음)
      if (data.config !== undefined) {
        setConfig(data.config);
        
        // config가 null이 되면 투표 상태 초기화
        if (data.config === null) {
          setSelected(null);
          setShowResult(false);
          setNumbersOpacity(0);
          hasVotedRef.current = null;
          hasShownResultRef.current = false;
        }
      }
      
      // 내일 예약 질문 여부 업데이트
      if (data.hasTomorrowPoll !== undefined) {
        setHasTomorrowPoll(data.hasTomorrowPoll);
      }

      const v = data.votes;
      const prev = latestVotesRef.current;
      const voteChanged = prev.A !== v.A || prev.B !== v.B;
      
      setVotes(v); // 이후 latestVotesRef가 업데이트됨

      // 투표 중이 아닐 때만 애니메이션 값 업데이트
      if (!isVotingInProgressRef.current) {
        // 애니메이션 값 업데이트
        const newTotal = v.A + v.B;
        const newPercentA = newTotal ? Math.round((v.A / newTotal) * 100) : 0;
        const newPercentB = newTotal ? 100 - newPercentA : 0;
        
        if (voteChanged) {
          // 폴링으로 값이 변경되면 카운팅 애니메이션 실행
          animateDigitChange(animARef.current, v.A, setAnimatedVotesA);
          animateDigitChange(animBRef.current, v.B, setAnimatedVotesB);
          animateDigitChange(animTotalRef.current, newTotal, setAnimatedTotal);
          animateDigitChange(animPARef.current, newPercentA, setAnimatedPercentA);
          animateDigitChange(animPBRef.current, newPercentB, setAnimatedPercentB);
        } else if (animTotalRef.current === 0) {
          // 첫 로드는 즉시 값 설정 (애니메이션 없음)
          setAnimatedVotesA(v.A);
          setAnimatedVotesB(v.B);
          setAnimatedTotal(newTotal);
          setAnimatedPercentA(newPercentA);
          setAnimatedPercentB(newPercentB);
        }
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
        setNumbersOpacity(0);
        
        // 투표하지 않은 상태이므로 해당 poll.id의 투표 기록 제거
        try {
          if (config?.id) {
            localStorage.removeItem(`voted:${config.id}`);
          }
        } catch {}
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [config?.id]); // deps를 최소화 - config.id가 바뀔 때만 함수 재생성

  // ===== 5초 간격 폴링 =====
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      if (isVotingInProgressRef.current) return;
      if (Date.now() < cooldownUntilRef.current) return; // 쿨다운 체크
      fetchVotesAndConfig();
    };
    
    tick(); // 초기 로드
    pollIntervalRef.current = setInterval(tick, 5000);

    // 이벤트 리스너 (디바운스 추가)
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const debouncedTick = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // 쿨다운 중이면 무시
        if (Date.now() < cooldownUntilRef.current) return;
        tick();
      }, 200);
    };
    
    const onFocus = () => debouncedTick();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted || (document as any).wasDiscarded) debouncedTick();
    };
    const onOnline = () => debouncedTick();

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow as any);
    window.addEventListener("online", onOnline);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
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


  // poll.id 변경 시 상태 초기화 (서버에서 이미 확인했으므로 localStorage는 보조적)
  useEffect(() => {
    if (!config?.id) return;
    
    // poll.id가 바뀌면 서버에서 받은 초기값으로 리셋
    setSelected(initialUserVote);
    setShowResult(initialUserVote !== null);
    setNumbersOpacity(initialUserVote !== null ? 1 : 0);
    hasShownResultRef.current = initialUserVote !== null;
    hasVotedRef.current = initialUserVote;
  }, [config?.id, initialUserVote]);

  // hasInitializedRef는 더 이상 사용하지 않음 (tick()에서 초기 로드 처리)

  // 투표 처리
  const handleVote = async (choice: "A" | "B") => {
    if (showResult || !config) return; // config가 없으면 투표 불가
    
    navigator.vibrate?.(20);
    
    // 투표 진행 중 플래그 설정
    isVotingInProgressRef.current = true;
    
    // 폴링 일시 중지
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    // 투표 직후 UI 세팅
    setSelected(choice);
    setShowResult(true);
    
    // 에러 시 롤백용
    const previousSelected = selected;
    const previousShowResult = showResult;

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
        cache: "no-store"
      });
      const data = await res.json();
      
      if (data.success && data.votes) {
        // 서버 응답으로 상태 업데이트
        setVotes(data.votes);
        latestVotesRef.current = data.votes;
        setSelected(choice);
        hasVotedRef.current = choice;
        hasShownResultRef.current = true;
        
        // 새로운 값 계산
        const tot = data.votes.A + data.votes.B;
        const pA = tot ? Math.round((data.votes.A / tot) * 100) : 0;
        const pB = tot ? 100 - pA : 0;
        
        // 서버 값으로 업데이트
        setAnimatedVotesA(data.votes.A);
        setAnimatedVotesB(data.votes.B);
        setAnimatedTotal(tot);
        setAnimatedPercentA(pA);
        setAnimatedPercentB(pB);
        
        // ref도 업데이트
        animARef.current = data.votes.A;
        animBRef.current = data.votes.B;
        animTotalRef.current = tot;
        animPARef.current = pA;
        animPBRef.current = pB;
        
        // 숫자 바로 표시
        setNumbersOpacity(1);
        
        // 투표 완료 플래그 해제
        isVotingInProgressRef.current = false;
        
        // 폴링 재시작
        if (!pollIntervalRef.current) {
          const tick = () => {
            if (document.hidden) return;
            if (isVotingInProgressRef.current) return;
            if (Date.now() < cooldownUntilRef.current) return;
            fetchVotesAndConfig();
          };
          pollIntervalRef.current = setInterval(tick, 5000);
        }
        
        // localStorage에 투표 여부 저장
        try {
          if (config?.id) {
            localStorage.setItem(`voted:${config.id}`, '1');
          }
        } catch {}
        
        try {
          if (!bcRef.current) bcRef.current = new BroadcastChannel("poll_channel");
          bcRef.current.postMessage({ type: "vote_update_hint", sender: senderIdRef.current });
        } catch {}
      } else {
        throw new Error("Server returned unsuccessful response");
      }
    } catch (error) {
      console.error("투표 실패:", error);
      
      // 실패 시 이전 상태로 완전 롤백
      setSelected(previousSelected);
      setShowResult(previousShowResult);
      setNumbersOpacity(0);
      hasVotedRef.current = null;
      hasShownResultRef.current = false;
      isVotingInProgressRef.current = false;
      
      // localStorage에서도 제거
      try {
        if (config?.id) {
          localStorage.removeItem(`voted:${config.id}`);
        }
      } catch {}
      
      // 폴링 재시작
      if (!pollIntervalRef.current) {
        const tick = () => {
          if (document.hidden) return;
          if (isVotingInProgressRef.current) return;
          if (Date.now() < cooldownUntilRef.current) return;
          fetchVotesAndConfig();
        };
        pollIntervalRef.current = setInterval(tick, 5000);
      }
      
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
    let bc: BroadcastChannel | null = null;
    
    try {
      if ("BroadcastChannel" in window) {
        bc = new BroadcastChannel("poll_channel");
        bcRef.current = bc;
        
        bc.onmessage = (event) => {
          // 쿨다운 중이면 무시
          if (Date.now() < cooldownUntilRef.current) return;
          if (isVotingInProgressRef.current) return;
          if (event?.data?.sender === senderIdRef.current) return; // 자기것 무시
          
          if (event.data.type === "config_update") forceRefreshConfig();
          if (event.data.type === "vote_update_hint") fetchVotesAndConfig();
        };
      }
    } catch (err) {
      console.warn("BroadcastChannel not supported:", err);
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "poll:config:ver" && e.newValue) {
        forceRefreshConfig();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      try {
        bc?.close();
      } catch {}
      window.removeEventListener("storage", onStorage);
      if (bcRef.current) bcRef.current = null;
    };
  }, [forceRefreshConfig, fetchVotesAndConfig]);

  // 오늘 질문이 없고 내일 예약 질문도 없으면 "질문이 없다" 페이지 표시
  if (!config && !hasTomorrowPoll) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="text-center px-4 flex flex-col items-center gap-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-400">
            설문조사가 아직 준비되지 않았습니다.
          </h2>
          <Link 
            href="/history" 
            className="inline-block text-sm text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-105"
          >
            이전 설문 결과 보기 →
          </Link>
        </div>
      </div>
    );
  }

  // config가 null이면 렌더링 불가 (내일 예약 질문이 있어도 현재 질문이 없으면 표시할 수 없음)
  if (!config) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl flex flex-col items-center gap-12 sm:gap-16 md:gap-20 transition-all duration-500 ease-out">
        <div className="text-center px-4">
          <h2
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
            disabled={showResult || !config}
            className={`
              group relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out touch-manipulation select-none
              ${showResult ? "cursor-default" : `cursor-pointer active:scale-[0.98] ${supportsHover ? "hover:scale-[1.05]" : ""}`}
              ${isAActive ? "shadow-[0_16px_40px_rgba(37,99,235,0.28)] scale-[1.03]" : "shadow-lg"}
            `}
            aria-pressed={isAActive}
          >
            {isAActive && <div className="absolute inset-0 z-[3] bg-black/5 md:backdrop-blur-[1px] pointer-events-none" />}
            
            {/* 배경 */}
            <div className="absolute inset-0 z-0 bg-neutral-50" />
            
            {/* hover 효과 (hover 지원 기기에서만) */}
            {!showResult && supportsHover && (
              <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden bg-gradient-to-br from-blue-400/40 to-blue-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
            
            {/* 선택된 색상 오버레이 */}
            {isAActive && (
              <div className="absolute inset-0 z-[2] bg-gradient-to-br from-blue-500 to-blue-600 transition-opacity duration-200" />
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
          </button>

          {/* B */}
          <button
            onClick={() => handleVote("B")}
            disabled={showResult || !config}
            className={`
              group relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden
              transition-all duration-300 ease-out touch-manipulation select-none
              ${showResult ? "cursor-default" : `cursor-pointer active:scale-[0.98] ${supportsHover ? "hover:scale-[1.05]" : ""}`}
              ${isBActive ? "shadow-[0_16px_40px_rgba(147,51,234,0.28)] scale-[1.03]" : "shadow-lg"}
            `}
            aria-pressed={isBActive}
          >
            {isBActive && <div className="absolute inset-0 z-[3] bg-black/5 md:backdrop-blur-[1px] pointer-events-none" />}
            
            {/* 배경 */}
            <div className="absolute inset-0 z-0 bg-neutral-50" />
            
            {/* hover 효과 (hover 지원 기기에서만) */}
            {!showResult && supportsHover && (
              <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden bg-gradient-to-br from-purple-400/40 to-purple-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
            
            {/* 선택된 색상 오버레이 */}
            {isBActive && (
              <div className="absolute inset-0 z-[2] bg-gradient-to-br from-purple-500 to-purple-600 transition-opacity duration-200" />
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
          </button>
        </div>

        {showResult && (
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
