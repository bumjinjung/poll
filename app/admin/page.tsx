"use client";

import { useEffect, useState } from "react";

type Config = {
  question: string;
  left: { label: string; emoji?: string };
  right: { label: string; emoji?: string };
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow">("today");
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
  const [resetVotes, setResetVotes] = useState(false);
  const [currentVotes, setCurrentVotes] = useState({ A: 0, B: 0 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

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
        if (res?.tomorrow) {
          setTomorrowConfig(res.tomorrow);
          setHasTomorrow(true);
        } else {
          setHasTomorrow(false);
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
    
    try {
      const res = await fetch("/api/admin/today", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ 
          ...config, 
          resetVotesFlag: isTomorrow ? false : resetVotes,
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
          setMessage("저장되었습니다. 메인 페이지를 새로고침하세요.");
          // 3.5초 후 메시지 fade-out
          setTimeout(() => setIsFadingOut(true), 3100);
          setTimeout(() => {
            setMessage(null);
            setIsFadingOut(false);
          }, 3500);
          if (resetVotes) {
            setCurrentVotes({ A: 0, B: 0 });
            setResetVotes(false);
          }
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

  // 로그인하지 않았으면 로그인 화면 표시
  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
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
    <div className="h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-xs">
        {/* 헤더 */}
        <div className="text-center" style={{ marginBottom: '12px' }}>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">📊</h1>
          <p className="text-gray-600 text-base font-medium">Poll 관리</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {/* 탭 */}
          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("today");
                setMessage(null);
                setIsFadingOut(false);
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
          </div>

          {/* 질문 */}
          <input
            value={config.question}
            onChange={(e) => setConfig({ ...config, question: e.target.value })}
            className="w-full rounded-lg border-2 border-gray-300 px-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
            placeholder="질문"
            required
            style={{ height: '30px' }}
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
                style={{ height: '30px' }}
              />
              <input
                value={config.left.emoji || ""}
                onChange={(e) => setConfig({ ...config, left: { ...config.left, emoji: e.target.value } })}
                maxLength={2}
                className="w-full rounded-lg border-2 border-blue-300 px-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-center"
                placeholder="🍦"
                style={{ height: '30px' }}
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
                style={{ height: '30px' }}
              />
              <input
                value={config.right.emoji || ""}
                onChange={(e) => setConfig({ ...config, right: { ...config.right, emoji: e.target.value } })}
                maxLength={2}
                className="w-full rounded-lg border-2 border-purple-300 px-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg text-center"
                placeholder="🙅"
                style={{ height: '30px' }}
              />
            </div>
          </div>

          {/* 메시지 */}
          {message && (
            <div className={`rounded-lg px-2 text-center text-xs font-medium flex items-center justify-center ${
              message.includes("실패") || message.includes("오류")
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            } ${isFadingOut ? 'fade-out' : ''}`} style={{ height: '30px' }}>
              {message}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-semibold hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 flex items-center justify-center"
              style={{ height: '30px' }}
            >
              {saving ? "저장 중..." : activeTab === "today" ? "저장" : "예약"}
            </button>
            
            {activeTab === "tomorrow" && hasTomorrow && (
              <button
                type="button"
                onClick={handleDeleteTomorrow}
                disabled={saving}
                className="rounded-lg border-2 border-red-400 text-red-600 hover:bg-red-50 disabled:opacity-50 text-xs font-semibold flex items-center justify-center"
                style={{ height: '30px', width: '50px' }}
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
              style={{ height: '30px', width: '80px' }}
            >
              나가기
            </button>
          </div>

          {/* 오늘/내일 Poll 하단 정보 */}
          {activeTab === "today" ? (
            <div className="bg-gray-50 rounded-lg px-2 flex items-center justify-between" style={{ height: '30px' }}>
              <span className="text-xs text-gray-600">투표: A {currentVotes.A} · B {currentVotes.B}</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetVotes}
                  onChange={(e) => setResetVotes(e.target.checked)}
                  className="w-3 h-3 rounded"
                />
                <span className="text-xs text-gray-600">초기화</span>
              </label>
            </div>
          ) : (
            <div style={{ height: '30px' }} />
          )}
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
        `}</style>
      </form>
    </div>
  );
}
