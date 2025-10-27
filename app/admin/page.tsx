"use client";

import { useEffect, useState, useRef } from "react";

type Config = {
  question: string;
  left: { label: string; emoji?: string };
  right: { label: string; emoji?: string };
};

// 히스토리 아이템 애니메이션 컴포넌트
function HistoryItemWithAnimation({ 
  item, 
  index, 
  onDelete, 
  onUpdate, 
  adminKey 
}: { 
  item: any; 
  index: number; 
  onDelete: (date: string) => void; 
  onUpdate: (date: string, votes: { A: number; B: number }) => void; 
  adminKey: string; 
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return;
    const el = hostRef.current;
    
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.unobserve(el); // 한 번만
        }
      },
      { root: null, threshold: 0.1, rootMargin: "100px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const total = item.votes.A + item.votes.B;
  const percentA = total ? Math.round((item.votes.A / total) * 100) : 50;
  const percentB = total ? Math.round((item.votes.B / total) * 100) : 50;
  
  const dateStr = item.date || "2025-10-22";
  const formattedDate = new Date(dateStr).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={hostRef}
      className={`
        w-full transition-all duration-500 ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
      `}
      style={{
        // 약간의 스태거 효과
        transitionDelay: visible ? `${(index % 10) * 40}ms` : "0ms",
      }}
    >
      {/* 질문 & 날짜 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-semibold text-gray-800">{item.poll.question}</h4>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{formattedDate}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{total.toLocaleString()}명 참여</span>
          </div>
          <button
            onClick={() => {
              if (confirm(`정말로 ${item.date} 히스토리를 삭제하시겠습니까?`)) {
                onDelete(item.date);
              }
            }}
            className="px-3 py-1 bg-red-500 text-white text-xs rounded-full hover:bg-red-600 transition-colors"
            title="삭제"
          >
            delete
          </button>
        </div>
      </div>

      {/* 투표 결과 */}
      <div>
        {/* Option A */}
        <div className="relative" style={{ marginBottom: '5px' }}>
          <div className="relative h-8 rounded-full overflow-hidden bg-gray-200">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"
              style={{
                width: visible ? `${percentA}%` : '0%',
                transition: "width 600ms ease-out",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-between" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
              <span className="text-xs text-white font-medium">
                {item.poll.left.emoji} {item.poll.left.label}
              </span>
              <span 
                className="text-xs text-gray-500 font-medium cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                onClick={async () => {
                  const newValue = prompt(`A 선택지 투표 수를 입력하세요 (현재: ${item.votes.A})`, item.votes.A.toString());
                  if (newValue !== null && newValue !== '') {
                    const numValue = parseInt(newValue) || 0;
                    await onUpdate(item.date, { A: numValue, B: item.votes.B });
                  }
                }}
              >
                {item.votes.A.toLocaleString()}표
              </span>
            </div>
            <span 
              className="text-sm font-bold text-gray-800 absolute"
              style={{
                opacity: visible ? 1 : 0,
                left: `${percentA}%`,
                top: '50%',
                transform: 'translateY(-50%) translateX(4px)',
                transition: 'opacity 0.3s ease-out',
                transitionDelay: visible ? '600ms' : '0ms'
              }}
            >
              {percentA}%
            </span>
          </div>
        </div>

        {/* Option B */}
        <div className="relative" style={{ marginBottom: '20px' }}>
          <div className="relative h-8 rounded-full overflow-hidden bg-gray-200">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full"
              style={{
                width: visible ? `${percentB}%` : '0%',
                transition: "width 600ms ease-out 120ms",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-between" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
              <span className="text-xs text-white font-medium">
                {item.poll.right.emoji} {item.poll.right.label}
              </span>
              <span 
                className="text-xs text-gray-500 font-medium cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                onClick={async () => {
                  const newValue = prompt(`B 선택지 투표 수를 입력하세요 (현재: ${item.votes.B})`, item.votes.B.toString());
                  if (newValue !== null && newValue !== '') {
                    const numValue = parseInt(newValue) || 0;
                    await onUpdate(item.date, { A: item.votes.A, B: numValue });
                  }
                }}
              >
                {item.votes.B.toLocaleString()}표
              </span>
            </div>
            <span 
              className="text-sm font-bold text-gray-800 absolute"
              style={{
                opacity: visible ? 1 : 0,
                left: `${percentB}%`,
                top: '50%',
                transform: 'translateY(-50%) translateX(4px)',
                transition: 'opacity 0.3s ease-out',
                transitionDelay: visible ? '720ms' : '0ms'
              }}
            >
              {percentB}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow" | "history">("today");
  const [todayConfig, setTodayConfig] = useState<Config>({
    question: "",
    left: { label: "" },
    right: { label: "" },
  });
  const [tomorrowConfig, setTomorrowConfig] = useState<Config>({
    question: "",
    left: { label: "" },
    right: { label: "" },
  });
  const [hasTomorrow, setHasTomorrow] = useState(false);
  const [currentVotes, setCurrentVotes] = useState({ A: 0, B: 0 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [resetVotes, setResetVotes] = useState(false); // 투표 초기화 체크박스

  useEffect(() => {
    if (isAuthenticated) {
      // 상태 초기화 후 데이터 가져오기
      setHasTomorrow(false);
      setTomorrowConfig({ question: "", left: { label: "" }, right: { label: "" } });
      fetchData();
    }
  }, [isAuthenticated]);

  // 탭 변경 시 서버에서 최신 데이터 가져오기
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (activeTab === "history" && isAuthenticated) {
      fetchHistory(true);
    }
  }, [activeTab, isAuthenticated]);

  // 무한스크롤을 위한 IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMoreHistory || loadingHistory) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingHistory) {
          fetchHistory(false);
        }
      },
      { root: null, rootMargin: "200px 0px", threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMoreHistory, loadingHistory]);

  const fetchData = () => {
    fetch("/api/admin/today", { 
      cache: "no-store",
      headers: {
        "x-admin-key": adminKey,
      },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.data) setTodayConfig(res.data);
        if (res?.votes) setCurrentVotes(res.votes);
        
        // 내일 설문 상태 확인 (더 엄격하게)
        if (res?.tomorrow && res.tomorrow.question && res.tomorrow.question.trim() !== "") {
          setTomorrowConfig(res.tomorrow);
          setHasTomorrow(true);
        } else {
          setHasTomorrow(false);
          setTomorrowConfig({ question: "", left: { label: "" }, right: { label: "" } });
        }
      })
      .catch(() => {});
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    
    if (inputKey.length < 3) {
      setLoginError("관리자 키가 너무 짧습니다.");
      return;
    }
    
    // 서버에서 비밀번호 검증
    try {
      const res = await fetch("/api/admin/today", {
        headers: {
          "x-admin-key": inputKey,
        },
      });
      
      if (!res.ok) {
        setLoginError("로그인 중 오류가 발생했습니다.");
        return;
      }
      
      const data = await res.json();
      
      // isAuthenticated 플래그로 인증 확인
      if (!data.isAuthenticated) {
        setLoginError("잘못된 관리자 키입니다.");
        return;
      }
      
      // 로그인 성공
      setAdminKey(inputKey);
      setIsAuthenticated(true);
    } catch (error) {
      setLoginError("서버 연결에 실패했습니다.");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    
    const config = activeTab === "today" ? todayConfig : tomorrowConfig;
    const isTomorrow = activeTab === "tomorrow";
    
    // 내일 설문이 이미 예약되어 있을 때 안내 메시지 표시
    if (isTomorrow && hasTomorrow) {
      setMessage("이미 내일 설문이 예약되어 있습니다. 기존 예약을 삭제한 후 다시 시도해주세요.");
      setTimeout(() => setIsFadingOut(true), 3100);
      setTimeout(() => {
        setMessage(null);
        setIsFadingOut(false);
      }, 3500);
      setSaving(false);
      return;
    }
    
    try {
      const res = await fetch("/api/admin/today", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ 
          ...config, 
          resetVotesFlag: isTomorrow ? false : resetVotes, // 오늘 질문: 체크박스 값 사용, 내일 질문: 항상 false
          isTomorrow
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (isTomorrow) {
          // 내일 탭에서도 메시지 표시 후 자동 사라지기
          setMessage("예약되었습니다.");
          setHasTomorrow(true);
          setTimeout(() => setIsFadingOut(true), 3100);
          setTimeout(() => {
            setMessage(null);
            setIsFadingOut(false);
          }, 3500);
        } else {
          setMessage("저장되었습니다.");
          // 3.5초 후 메시지 fade-out
          setTimeout(() => setIsFadingOut(true), 3100);
          setTimeout(() => {
            setMessage(null);
            setIsFadingOut(false);
          }, 3500);
          
          // 체크박스 초기화
          setResetVotes(false);
          
          // 브라우저 전체에 즉시 반영
          const bc = new BroadcastChannel("poll_channel");
          bc.postMessage({ type: "config_update" });
          bc.close();
          localStorage.setItem("poll:config:ver", String(Date.now()));
        }
        fetchData();
      } else {
        setMessage(data.message || "저장 실패");
        setTimeout(() => setIsFadingOut(true), 3100);
        setTimeout(() => {
          setMessage(null);
          setIsFadingOut(false);
        }, 3500);
      }
    } catch (err) {
      setMessage("오류가 발생했습니다.");
      setTimeout(() => setIsFadingOut(true), 3100);
      setTimeout(() => {
        setMessage(null);
        setIsFadingOut(false);
      }, 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTomorrow = async () => {
    if (!confirm("내일 poll을 삭제하시겠습니까?")) return;
    
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/today", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ deleteTomorrow: true }),
      });
      const data = await res.json();
      if (data.success) {
        // 삭제 메시지는 안 띄움
        setHasTomorrow(false);
        setTomorrowConfig({ question: "", left: { label: "" }, right: { label: "" } });
        fetchData();
      } else {
        setMessage(data.message || "삭제 실패");
        setTimeout(() => setIsFadingOut(true), 3100);
        setTimeout(() => {
          setMessage(null);
          setIsFadingOut(false);
        }, 3500);
      }
    } catch (err) {
      setMessage("오류가 발생했습니다.");
      setTimeout(() => setIsFadingOut(true), 3100);
      setTimeout(() => {
        setMessage(null);
        setIsFadingOut(false);
      }, 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGenerate = async (type: "today" | "tomorrow") => {
    setAutoGenerating(true);
    setMessage(null);
    
    try {
      const res = await fetch("/api/admin/auto-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // 성공 메시지 (ChatGPT 성공 또는 기본 템플릿 사용)
        if (data.isFallback) {
          setMessage(`⚠️ ${data.message}`);
        } else {
          setMessage(`✅ ${data.message}`);
        }
        
        if (type === "today") {
          setTodayConfig(data.poll);
          // 오늘 설문의 경우 투표 수는 초기화하지 않음 (기존 투표 유지)
        } else if (type === "tomorrow" && data.poll && data.poll.question) {
          setTomorrowConfig(data.poll);
          // 내일 설문의 경우도 hasTomorrow를 true로 설정하지 않음 (입력 필드에만 표시)
        }
        
        // 오늘 설문이 이미 있어도 새로운 설문 내용을 입력 필드에 표시
        if (type === "today" && data.poll) {
          setTodayConfig(data.poll);
        }
        
        // 내일 설문이 이미 있어도 새로운 설문 내용을 입력 필드에 표시
        if (type === "tomorrow" && data.poll) {
          setTomorrowConfig(data.poll);
        }
        
        // 오류가 있으면 더 오래 표시
        const displayTime = data.isFallback ? 5000 : 3500;
        setTimeout(() => setIsFadingOut(true), displayTime - 400);
        setTimeout(() => {
          setMessage(null);
          setIsFadingOut(false);
        }, displayTime);
      } else {
        setMessage(`❌ ${data.message || "자동 생성 실패"}`);
        setTimeout(() => setIsFadingOut(true), 3100);
        setTimeout(() => {
          setMessage(null);
          setIsFadingOut(false);
        }, 3500);
      }
    } catch (error) {
      setMessage("자동 생성 중 오류가 발생했습니다.");
      setTimeout(() => setIsFadingOut(true), 3100);
      setTimeout(() => {
        setMessage(null);
        setIsFadingOut(false);
      }, 3500);
    } finally {
      setAutoGenerating(false);
    }
  };

  // 히스토리 관리 함수들
  const fetchHistory = async (reset = false) => {
    if (loadingHistory) return;
    
    setLoadingHistory(true);
    try {
      console.log("히스토리 로드 시작...", reset ? "(초기화)" : "(추가)");
      const cursor = reset ? null : nextCursor;
      const res = await fetch(`/api/history?cursor=${cursor || ''}&limit=10`);
      const data = await res.json();
      console.log("히스토리 데이터:", data);
      
      if (data.success) {
        if (reset) {
          setHistoryItems(data.items);
          setHistoryPage(0);
        } else {
          setHistoryItems(prev => [...prev, ...data.items]);
          setHistoryPage(prev => prev + 1);
        }
        setHasMoreHistory(data.hasMore);
        setNextCursor(data.nextCursor);
        console.log("히스토리 아이템 설정 완료:", data.items.length, "개");
      }
    } catch (error) {
      console.error("히스토리 로드 실패:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const deleteHistory = async (date: string) => {
    if (!confirm(`정말로 ${date} 히스토리를 삭제하시겠습니까?`)) return;
    
    try {
      const res = await fetch(`/api/admin/delete-history?date=${date}`, {
        method: "DELETE",
        headers: {
          "x-admin-key": adminKey,
        },
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage(`✅ ${data.message}`);
        fetchHistory(true); // 히스토리 목록 새로고침
      } else {
        setMessage(`❌ ${data.message}`);
      }
      
      setTimeout(() => setIsFadingOut(true), 3100);
      setTimeout(() => {
        setMessage(null);
        setIsFadingOut(false);
      }, 3500);
    } catch (error) {
      setMessage("히스토리 삭제 중 오류가 발생했습니다.");
    }
  };

  const updateHistory = async (date: string, votes: { A: number; B: number }) => {
    try {
      const res = await fetch("/api/admin/fix-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ date, votes }),
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage(`✅ ${data.message}`);
        // 히스토리 아이템 상태 직접 업데이트
        setHistoryItems(prevItems => 
          prevItems.map(item => 
            item.date === date 
              ? { ...item, votes: votes }
              : item
          )
        );
      } else {
        setMessage(`❌ ${data.message}`);
      }
      
      setTimeout(() => setIsFadingOut(true), 3100);
      setTimeout(() => {
        setMessage(null);
        setIsFadingOut(false);
      }, 3500);
    } catch (error) {
      setMessage("히스토리 수정 중 오류가 발생했습니다.");
    }
  };

  // 로그인하지 않았으면 로그인 화면 표시
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-[240px]">
          <div className="text-center mb-6">
            <h1 className="text-5xl mb-1 text-center">🔐</h1>
            <p className="text-gray-700 font-medium text-lg text-center">관리자 페이지</p>
          </div>

          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            className="w-full rounded-lg border-2 border-gray-300 px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-sm"
            placeholder=""
            required
            autoFocus
            style={{
              marginTop: '5px',
              colorScheme: 'light',
              height: '30px',
              fontSize: '14px',
              lineHeight: '20px',
              marginBottom: '5px'
            }}
          />
          {loginError && (
            <p className="text-xs text-red-500 text-center font-medium mb-6">{loginError}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-semibold hover:from-blue-600 hover:to-purple-600 text-center flex items-center justify-center"
            style={{ height: '30px' }}
          >
            로그인
          </button>

          <style jsx>{`
            input:-webkit-autofill,
            input:-webkit-autofill:hover,
            input:-webkit-autofill:focus,
            input:-webkit-autofill:active {
              -webkit-box-shadow: 0 0 0 1000px white inset !important;
              -webkit-text-fill-color: #1f2937 !important;
              caret-color: #1f2937 !important;
              font-size: 14px !important;
              line-height: 20px !important;
              padding: 8px 16px !important;
              height: 40px !important;
            }
            input:-webkit-autofill::placeholder {
              -webkit-text-fill-color: #d1d5db !important;
            }
          `}</style>
        </form>
      </div>
    );
  }

  const config = activeTab === "today" ? todayConfig : tomorrowConfig;
  const setConfig = activeTab === "today" ? setTodayConfig : setTomorrowConfig;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-4xl">
        {/* 헤더 */}
        <div className="text-center" style={{ marginBottom: '12px' }}>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">📊</h1>
          <p className="text-gray-600 text-base font-medium">Poll 관리</p>
        </div>

        {/* 홈으로 링크 - 모든 탭에 표시 */}
        <div className="w-full mb-4" style={{ marginLeft: '0px' }}>
          <a
            href="/"
            className="text-gray-600 hover:text-gray-900 active:scale-110 transition-all duration-200 text-sm font-medium flex items-center gap-2"
          >
            <span>←</span>
            <span>홈으로</span>
          </a>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {/* 탭 */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("today");
                setMessage(null);
                setIsFadingOut(false);
                setResetVotes(false);
              }}
              className={`flex-1 px-2 rounded-lg text-xs font-semibold flex items-center justify-center ${
                activeTab === "today"
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                  : "text-gray-600"
              }`}
              style={{ height: '28px' }}
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("tomorrow");
                setMessage(null);
                setIsFadingOut(false);
                setResetVotes(false);
              }}
              className={`flex-1 px-2 rounded-lg text-xs font-semibold relative flex items-center justify-center ${
                activeTab === "tomorrow"
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                  : "text-gray-600"
              }`}
              style={{ height: '28px' }}
            >
              내일
              {hasTomorrow && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("history");
                setMessage(null);
                setIsFadingOut(false);
                setResetVotes(false);
              }}
              className={`flex-1 px-2 rounded-lg text-xs font-semibold flex items-center justify-center ${
                activeTab === "history"
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                  : "text-gray-600"
              }`}
              style={{ height: '28px' }}
            >
              히스토리
            </button>
          </div>

          {/* 히스토리 탭이 아닐 때만 폼 표시 */}
          {activeTab !== "history" && (
            <>
              {/* 질문 */}
              <input
                value={config.question}
                onChange={(e) => setConfig({ ...config, question: e.target.value })}
                className="w-full rounded-lg border-2 border-gray-300 px-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                placeholder="질문"
                required
                style={{ height: '40px' }}
              />

              {/* 선택지 */}
              <div className="grid grid-cols-2 gap-2">
                {/* A */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <input
                    value={config.left.label}
                    onChange={(e) => setConfig({ ...config, left: { ...config.left, label: e.target.value } })}
                    className="w-full rounded-lg border-2 border-blue-300 px-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    placeholder="A 라벨"
                    required
                    style={{ height: '40px' }}
                  />
                  <input
                    value={config.left.emoji || ""}
                    onChange={(e) => setConfig({ ...config, left: { ...config.left, emoji: e.target.value } })}
                    maxLength={2}
                    className="w-full rounded-lg border-2 border-blue-300 px-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-center"
                    placeholder="🍦"
                    style={{ height: '40px' }}
                  />
                </div>

                {/* B */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <input
                    value={config.right.label}
                    onChange={(e) => setConfig({ ...config, right: { ...config.right, label: e.target.value } })}
                    className="w-full rounded-lg border-2 border-purple-300 px-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                    placeholder="B 라벨"
                    required
                    style={{ height: '40px' }}
                  />
                  <input
                    value={config.right.emoji || ""}
                    onChange={(e) => setConfig({ ...config, right: { ...config.right, emoji: e.target.value } })}
                    maxLength={2}
                    className="w-full rounded-lg border-2 border-purple-300 px-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg text-center"
                    placeholder="🙅"
                    style={{ height: '40px' }}
                  />
                </div>
              </div>
              
              {/* 버튼 */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-semibold hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 flex items-center justify-center"
                  style={{ height: '40px' }}
                >
                  {saving ? "저장 중..." : activeTab === "today" ? "저장" : "예약"}
                </button>
                
                <button
                  type="button"
                  onClick={() => handleAutoGenerate(activeTab)}
                  disabled={autoGenerating || saving}
                  className="rounded-lg bg-gradient-to-r from-green-500 to-teal-500 text-white text-xs font-semibold hover:from-green-600 hover:to-teal-600 disabled:opacity-50 flex items-center justify-center"
                  style={{ height: '40px', width: '60px' }}
                >
                  {autoGenerating ? "생성 중..." : "🤖"}
                </button>
                
                {activeTab === "tomorrow" && hasTomorrow && (
                  <button
                    type="button"
                    onClick={handleDeleteTomorrow}
                    disabled={saving}
                    className="rounded-lg border-2 border-red-400 text-red-600 hover:bg-red-50 disabled:opacity-50 text-xs font-semibold flex items-center justify-center"
                    style={{ height: '40px', width: '50px' }}
                  >
                    삭제
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsAuthenticated(false);
                    setAdminKey("");
                    setInputKey("");
                  }}
                  className="rounded-lg border-2 border-gray-300 text-gray-600 hover:bg-gray-100 text-xs flex items-center justify-center"
                  style={{ height: '40px', width: '80px' }}
                >
                  나가기
                </button>
              </div>

              {/* 오늘/내일 Poll 하단 정보 */}
              {activeTab === "today" ? (
                <div className="px-2 flex items-center justify-between" style={{ height: '40px' }}>
                  <span className="text-xs text-gray-600">투표: A {currentVotes.A} · B {currentVotes.B}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetVotes}
                      onChange={(e) => setResetVotes(e.target.checked)}
                      className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
                    />
                    <span className="text-xs text-gray-600 select-none">
                      투표 초기화
                    </span>
                  </label>
                </div>
              ) : (
                <div className="px-2 flex items-center justify-center" style={{ height: '40px' }}>
                  {hasTomorrow ? (
                    <span className="text-xs text-green-600">✓ 예약이 되었습니다</span>
                  ) : (
                    <span className="text-xs text-gray-400">예약이 없습니다</span>
                  )}
                </div>
              )}
            </>
          )}

          {/* 히스토리 탭 UI */}
          {activeTab === "history" && (
            <div className="space-y-6">
              <div className="space-y-6">
                {historyItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>히스토리가 없습니다</p>
                  </div>
                ) : (
                  historyItems.map((item, index) => {
                    return (
                      <HistoryItemWithAnimation 
                        key={index} 
                        item={item} 
                        index={index}
                        onDelete={deleteHistory}
                        onUpdate={updateHistory}
                        adminKey={adminKey}
                      />
                    );
                  })
                )}
                
                {/* 무한스크롤 센티넬 */}
                {hasMoreHistory && (
                  <div ref={sentinelRef} className="flex items-center justify-center py-6">
                    <span className="text-xs text-gray-400">
                      {loadingHistory ? "불러오는 중..." : "아래로 스크롤하면 더 보기"}
                    </span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* 메시지 */}
          <div className={`rounded-lg px-2 text-center text-xs font-medium flex items-center justify-center ${
            message ? (
              message.includes("❌") || message.includes("실패") || message.includes("오류")
                ? "bg-red-100 text-red-700"
                : message.includes("⚠️")
                ? "bg-yellow-100 text-yellow-700"
                : "bg-green-100 text-green-700"
            ) : ""
          } ${isFadingOut ? 'fade-out' : ''}`} style={{ height: '40px' }}>
            {message || ""}
          </div>
        </div>


        <style jsx>{`
          @keyframes fadeOut {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }
          .fade-out {
            animation: fadeOut 0.4s ease-out forwards;
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(24px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </form>
    </div>
  );
}
