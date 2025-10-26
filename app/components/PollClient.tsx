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
  const [isUpdating, setIsUpdating] = useState(false);
  const [animatedTotal, setAnimatedTotal] = useState(initialVotes.A + initialVotes.B);
  const [previousTotal, setPreviousTotal] = useState(0);
  const [previousPercentA, setPreviousPercentA] = useState(0);
  const [previousPercentB, setPreviousPercentB] = useState(0);
  const [previousVotesA, setPreviousVotesA] = useState(0);
  const [previousVotesB, setPreviousVotesB] = useState(0);
  const [questionKey, setQuestionKey] = useState(0); // 질문 변경 감지용
  const [voteEffect, setVoteEffect] = useState<"A" | "B" | null>(null); // 투표 효과 상태
  const cardRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(
    () => `poll-voted-${config?.question || ""}`,
    [config?.question]
  );

  // 버튼 활성화 상태 (깜빡임 방지)
  const isAActive = selected === "A" || pendingChoice === "A";
  const isBActive = selected === "B" || pendingChoice === "B";

  // 카드 등장 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);


  const total = (votes?.A || 0) + (votes?.B || 0);
  const percentA = total > 0 ? Math.round(((votes?.A || 0) / total) * 100) : 0;
  const percentB = total > 0 ? Math.round(((votes?.B || 0) / total) * 100) : 0;

  // requestAnimationFrame을 사용한 부드러운 애니메이션 함수
  const animateDigitChange = (previous: number, current: number, setter: (value: number) => void) => {
    if (previous === current) return;
    
    const duration = 600; // 0.6초
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutCubic 이징 함수 적용
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const animatedValue = previous + (current - previous) * easedProgress;
      
      setter(Math.round(animatedValue));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };

  // 컴포넌트 내부 어딘가에 추가
  const applyAnimatedSnapshot = useCallback((
    base: VoteData,
    extra?: "A" | "B"
  ) => {
    const nextA = base.A + (extra === "A" ? 1 : 0);
    const nextB = base.B + (extra === "B" ? 1 : 0);
    const nextTotal = nextA + nextB;
    const nextPercentA = nextTotal ? Math.round((nextA / nextTotal) * 100) : 0;
    const nextPercentB = nextTotal ? 100 - nextPercentA : 0;

    // 즉시 화면에 숫자/퍼센트를 채움
    setAnimatedVotesA(nextA);
    setAnimatedVotesB(nextB);
    setAnimatedTotal(nextTotal);
    setAnimatedPercentA(nextPercentA);
    setAnimatedPercentB(nextPercentB);

    // 이후 변경 시에는 변화분만 애니메이션하도록 기준값도 맞춰둠
    setPreviousVotesA(nextA);
    setPreviousVotesB(nextB);
    setPreviousTotal(nextTotal);
    setPreviousPercentA(nextPercentA);
    setPreviousPercentB(nextPercentB);
  }, []);

  // 퍼센트 카운팅 애니메이션 (첫 로드 시) - requestAnimationFrame 사용
  useEffect(() => {
    if (showResult && synced && previousPercentA === 0) {
      // 이미 투표한 사용자의 경우 애니메이션 건너뛰기 (즉시 표시)
      if (selected) {
        // 이미 fetchVotes에서 애니메이션 값이 설정되었으므로 애니메이션 없이 이전 값만 저장
        setPreviousPercentA(percentA);
        setPreviousPercentB(percentB);
        setPreviousVotesA(votes?.A || 0);
        setPreviousVotesB(votes?.B || 0);
        setPreviousTotal(total);
        return;
      }
      
      const duration = 1500; // 1.5초
      const startTime = performance.now();
      
      const animateValue = (start: number, end: number, setter: (value: number) => void) => {
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // easeOutCubic 이징 함수 적용
          const easedProgress = 1 - Math.pow(1 - progress, 3);
          const animatedValue = start + (end - start) * easedProgress;
          
          setter(Math.round(animatedValue));
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        
        requestAnimationFrame(animate);
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
  }, [showResult, synced, percentA, percentB, votes?.A, votes?.B, total, previousPercentA, selected]);

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


  // SSE로 실시간 업데이트 처리 (자동 재연결 포함)
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const baseDelay = 500; // 0.5초
    const maxDelay = 2500; // 2.5초

    const connectSSE = () => {
      if (es) {
        es.close();
      }
      
      es = new EventSource("/api/vote/stream");
      
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          
          if (payload.type === "vote_update") {
            // 투표 수 업데이트 (달라진 경우에만 상태 갱신)
            setVotes(prev => {
              if (prev.A === payload.votes.A && prev.B === payload.votes.B) return prev;
              return payload.votes;
            });
            
            // 애니메이션 상태도 즉시 업데이트
            const newTotal = payload.votes.A + payload.votes.B;
            const newPercentA = newTotal > 0 ? Math.round((payload.votes.A / newTotal) * 100) : 0;
            const newPercentB = newTotal > 0 ? Math.round((payload.votes.B / newTotal) * 100) : 0;
            setAnimatedPercentA(newPercentA);
            setAnimatedPercentB(newPercentB);
            setAnimatedVotesA(payload.votes.A);
            setAnimatedVotesB(payload.votes.B);
            setAnimatedTotal(newTotal);
          }
          
          if (payload.type === "config_update") {
            // 질문 변경 감지
            if (payload.config && JSON.stringify(payload.config) !== JSON.stringify(config)) {
              setConfig(payload.config);
              // 질문이 변경되어도 기존 투표 결과는 유지 (서버에서 확인)
              fetchVotes();
            }
          }
          
          // 연결 성공 시 재연결 시도 횟수 리셋
          reconnectAttempts = 0;
        } catch (error) {
          console.error("SSE message parsing error:", error);
        }
      };
      
      es.onerror = () => {
        console.error("SSE connection error, attempting to reconnect...");
        es?.close();
        
        if (reconnectAttempts < maxReconnectAttempts) {
          // 지수 백오프: 0.5초 ~ 2.5초
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay);
          reconnectAttempts++;
          
          reconnectTimeout = setTimeout(() => {
            connectSSE();
          }, delay);
        } else {
          console.error("SSE max reconnection attempts reached");
        }
      };
    };

    // 초기 연결
    connectSSE();
    
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (es) {
        es.close();
      }
    };
  }, []);

  // 관리자 페이지에서 설정 변경 시 강제 새로고침
  const forceRefreshConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/today", { cache: "no-store" });
      const data = await res.json();
      if (data?.data) {
        setConfig(data.data);
        
        // 애니메이션 및 상태 초기화
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
        
        // 서버와 동기화 - fetchVotes를 직접 호출하지 않고 상태 업데이트 후 useEffect에서 처리
        // fetchVotes는 useEffect에서 config 변경을 감지하여 자동으로 호출됨
      }
    } catch (error) {
      console.error("Force refresh config error:", error);
    }
  }, []);

  useEffect(() => {
    // 마운트 즉시 한 번 최신 투표 수와 userVote를 가져와 SSR과의 차이를 없앰
    fetchVotes();
    
    // BroadcastChannel을 통한 로컬 브로드캐스트 수신
    const broadcastChannel = new BroadcastChannel("poll_channel");
    broadcastChannel.onmessage = (event) => {
      if (event.data.type === "config_update") {
        forceRefreshConfig();
      }
    };
    
    // localStorage 이벤트를 통한 로컬 브로드캐스트 수신
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "poll:config:ver" && e.newValue) {
        forceRefreshConfig();
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      broadcastChannel.close();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [forceRefreshConfig]);


  // 질문 변경 감지 및 로컬 상태 동기화
  const prevQuestionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!config) return;

    // 이전 질문 키 제거
    const prevQ = prevQuestionRef.current;
    if (prevQ && prevQ !== config.question) {
      try {
        localStorage.removeItem(`poll-voted-${prevQ}`);
      } catch {}
    }

    // 현재 질문을 다음 비교를 위해 저장
    prevQuestionRef.current = config.question;

    // 질문 변경 시 애니메이션 트리거
    setQuestionKey(prev => prev + 1);

    // 애니메이션 및 상태 초기화
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
    setPendingChoice(null); // 질문 변경 시 pendingChoice도 초기화

    // 서버와 동기화
    fetchVotes();
  }, [config?.question]);

  useEffect(() => {
    if (selected && animatedTotal === 0) {
      applyAnimatedSnapshot(votes); // 현재 표 기준으로 즉시 채움
    }
  }, [selected, votes, animatedTotal, applyAnimatedSnapshot]);

  const fetchVotes = useCallback(async () => {
    try {
      setIsUpdating(true);
      const res = await fetch("/api/vote", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        // 투표 수 업데이트 (항상 업데이트하여 최신 상태 유지)
        setVotes(data.votes);
        setSynced(true);
        
        // 서버에서 사용자의 투표 정보를 받았으면 상태 업데이트
        if (data.userVote) {
          // 서버에 투표 기록이 있으면 클라이언트 상태와 동기화
          setSelected(data.userVote);
          setShowResult(true);
          setSynced(true);
          // 애니메이션 상태를 서버에서 받은 값으로 즉시 설정
          const newTotal = data.votes.A + data.votes.B;
          const newPercentA = newTotal > 0 ? Math.round((data.votes.A / newTotal) * 100) : 0;
          const newPercentB = newTotal > 0 ? Math.round((data.votes.B / newTotal) * 100) : 0;
          setAnimatedPercentA(newPercentA);
          setAnimatedPercentB(newPercentB);
          setAnimatedVotesA(data.votes.A);
          setAnimatedVotesB(data.votes.B);
          setAnimatedTotal(newTotal);
          
          // 서버에서 받은 투표 정보를 로컬스토리지에 저장
          try {
            const currentStorageKey = `poll-voted-${config?.question || ""}`;
            localStorage.setItem(currentStorageKey, JSON.stringify({ selected: data.userVote }));
          } catch (e) {
            // 시크릿 모드 등에서 로컬스토리지 접근 불가 시 무시
          }
        } else {
          // 서버에 투표 기록이 없으면 클라이언트 상태도 초기화 (부드럽게)
          // 단, pendingChoice가 있으면 투표 중이므로 초기화하지 않음
          if ((selected || showResult) && !pendingChoice) {
            setSelected(null);
            setShowResult(false);
            setSynced(false);
          }
          try {
            const currentStorageKey = `poll-voted-${config?.question || ""}`;
            localStorage.removeItem(currentStorageKey);
          } catch (e) {
            // 시크릿 모드 등에서 로컬스토리지 접근 불가 시 무시
          }
        }
      }
    } catch {}
    finally {
      setTimeout(() => setIsUpdating(false), 300);
    }
  }, []);

  // ✅ 클라이언트에서만 localStorage 읽기 (Hydration 오류 방지)
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
          // 로컬스토리지에서 읽은 후 서버와 동기화
          fetchVotes();
          return;
        }
      }
    } catch {}
    setSelected(null);
    setShowResult(false);
    setSynced(false);
    // 로컬스토리지에 없으면 서버에서 확인
    fetchVotes();
  }, [config?.question, fetchVotes]);

  const handleVote = async (choice: "A" | "B") => {
    if (showResult) return;

    navigator.vibrate?.(20);
    setPendingChoice(choice);
    setSelected(choice);

    // ✅ 여기! 0이 보이지 않도록 즉시 현재표 + 내 선택 1표 스냅샷을 채웁니다.
    applyAnimatedSnapshot(votes, choice);

    setShowResult(true);            // 결과 화면 전환
    setSynced(false);               // 서버 동기화 전 상태

    // 투표 효과 트리거
    setVoteEffect(choice);
    setTimeout(() => setVoteEffect(null), 600); // 0.6초 후 효과 제거

    // 이후 서버 POST는 그대로 유지
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
        localStorage.setItem(storageKey, JSON.stringify({ selected: choice }));
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
          <h2 
            key={questionKey}
            className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-800 animate-fade-in-slide-up"
            style={{
              animation: 'fadeInSlideUp 0.6s ease-out forwards'
            }}
          >
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
              ${isAActive ? "shadow-[0_20px_60px_rgba(37,99,235,0.35)] scale-[1.03]" : "shadow-lg"}
            `}
          >
            {/* 백드롭 레이어 */}
            {isAActive && (
              <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px] pointer-events-none" />
            )}
            
            {/* 링 스윕 애니메이션 */}
            {isAActive && (
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, rgba(37, 99, 235, 0.3), transparent)',
                  borderRadius: 'inherit'
                }}
              >
                <div className="animate-ringSweep w-full h-full" />
              </div>
            )}
            
            {/* 빛(shine) 효과 */}
            {isAActive && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div 
                  className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine"
                  style={{ transform: 'translateX(-100%)' }}
                />
              </div>
            )}
            
            {/* 호버 시 채워지는 애니메이션 */}
            {!showResult && (
              <div 
                className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-blue-400/40 to-blue-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 hover-fill"
                style={{
                  transform: 'scaleY(0)',
                  transformOrigin: 'bottom',
                  transition: 'opacity 0.3s ease, transform 0.6s ease-out'
                }}
              />
            )}
            
            <div
              className={`
                absolute inset-0 transition-all duration-500 origin-bottom
                ${isAActive ? "bg-gradient-to-br from-blue-500 to-blue-600 scale-y-100" : "bg-neutral-50 scale-y-0"}
              `}
              style={{
                transform: isAActive ? 'scaleY(1)' : 'scaleY(0)',
                transformOrigin: 'bottom center'
              }}
            />

            <div className="relative h-full flex flex-col items-center justify-center p-3 sm:p-4 gap-1 sm:gap-2">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isAActive ? "scale-110" : showResult ? "" : "group-hover:scale-105"}`}>
                {config.left.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold transition-colors ${isAActive ? "text-white" : "text-gray-800"}`}>
                {config.left.label}
              </div>
              {showResult && synced && (
                <div className={`mt-1 sm:mt-2 animate-fadeIn ${isAActive ? "text-white" : "text-gray-900"}`}>
                  <div 
                    className="text-xl sm:text-2xl font-bold mb-0.5 transition-opacity duration-300"
                    style={{ opacity: animatedPercentA > 0 ? 1 : 0 }}
                  >
                    {animatedPercentA}%
                  </div>
                  <div className={`text-xs ${isAActive ? "text-blue-100" : "text-gray-600"}`}>{animatedVotesA.toLocaleString()} votes</div>
                </div>
              )}
            </div>
            {isAActive && (
              <div className="absolute inset-0 ring-4 ring-blue-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem]" />
            )}
            {voteEffect === "A" && (
              <div 
                className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
                  animation: 'votePopEffect 0.6s ease-out forwards'
                }}
              />
            )}
          </button>

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
            {/* 백드롭 레이어 */}
            {isBActive && (
              <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px] pointer-events-none" />
            )}
            
            {/* 링 스윕 애니메이션 */}
            {isBActive && (
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, rgba(147, 51, 234, 0.3), transparent)',
                  borderRadius: 'inherit'
                }}
              >
                <div className="animate-ringSweep w-full h-full" />
              </div>
            )}
            
            {/* 빛(shine) 효과 */}
            {isBActive && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div 
                  className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine"
                  style={{ transform: 'translateX(-100%)' }}
                />
              </div>
            )}
            
            {/* 호버 시 채워지는 애니메이션 */}
            {!showResult && (
              <div 
                className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-purple-400/40 to-purple-500/30 opacity-0 group-hover:opacity-100 transition-all duration-300 hover-fill"
                style={{
                  transform: 'scaleY(0)',
                  transformOrigin: 'bottom',
                  transition: 'opacity 0.3s ease, transform 0.6s ease-out'
                }}
              />
            )}
            
            <div
              className={`
                absolute inset-0 transition-all duration-500 origin-bottom
                ${isBActive ? "bg-gradient-to-br from-purple-500 to-purple-600 scale-y-100" : "bg-neutral-50 scale-y-0"}
              `}
              style={{
                transform: isBActive ? 'scaleY(1)' : 'scaleY(0)',
                transformOrigin: 'bottom center'
              }}
            />

            <div className="relative h-full flex flex-col items-center justify-center p-3 sm:p-4 gap-1 sm:gap-2">
              <div className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-300 ${isBActive ? "scale-110" : showResult ? "" : "group-hover:scale-105"}`}>
                {config.right.emoji ?? ""}
              </div>
              <div className={`text-sm sm:text-base md:text-lg font-semibold transition-colors ${isBActive ? "text-white" : "text-gray-800"}`}>
                {config.right.label}
              </div>
              {showResult && synced && (
                <div className={`mt-1 sm:mt-2 animate-fadeIn ${isBActive ? "text-white" : "text-gray-900"}`}>
                  <div 
                    className="text-xl sm:text-2xl font-bold mb-0.5 transition-opacity duration-300"
                    style={{ opacity: animatedPercentB > 0 ? 1 : 0 }}
                  >
                    {animatedPercentB}%
                  </div>
                  <div className={`text-xs ${isBActive ? "text-purple-100" : "text-gray-600"}`}>{animatedVotesB.toLocaleString()} votes</div>
                </div>
              )}
            </div>
            {isBActive && (
              <div className="absolute inset-0 ring-4 ring-purple-400 ring-offset-4 ring-offset-transparent rounded-[1.5rem] sm:rounded-[2rem]" />
            )}
            {voteEffect === "B" && (
              <div 
                className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, transparent 70%)',
                  animation: 'votePopEffect 0.6s ease-out forwards'
                }}
              />
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


