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
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = () => {
    fetch("/api/admin/today", { cache: "no-store" })
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    
    // 간단한 클라이언트 측 검증 (실제 검증은 API에서)
    if (inputKey.length < 3) {
      setLoginError("관리자 키가 너무 짧습니다.");
      return;
    }
    
    setAdminKey(inputKey);
    setIsAuthenticated(true);
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
          setMessage("내일 poll이 저장되었습니다. 자정에 자동으로 적용됩니다.");
          setHasTomorrow(true);
        } else {
          setMessage("저장되었습니다. 메인 페이지를 새로고침하세요.");
          if (resetVotes) {
            setCurrentVotes({ A: 0, B: 0 });
            setResetVotes(false);
          }
        }
        fetchData();
      } else {
        setMessage(data.message || "저장 실패");
      }
    } catch (err) {
      setMessage("오류가 발생했습니다.");
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
        setMessage("내일 poll이 삭제되었습니다.");
        setHasTomorrow(false);
        setTomorrowConfig({ question: "", left: { label: "" }, right: { label: "" } });
        fetchData();
      } else {
        setMessage(data.message || "삭제 실패");
      }
    } catch (err) {
      setMessage("오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 로그인하지 않았으면 로그인 화면 표시
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md space-y-6 bg-white rounded-2xl p-8 shadow-lg"
        >
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">🔒 Admin</h1>
            <p className="text-sm text-gray-600">관리자 인증이 필요합니다</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">관리자 키</label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="관리자 키를 입력하세요"
              required
            />
            {loginError && (
              <p className="text-sm text-red-600">{loginError}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-black text-white py-3 font-semibold hover:bg-gray-800 transition"
          >
            로그인
          </button>
        </form>
      </div>
    );
  }

  const config = activeTab === "today" ? todayConfig : tomorrowConfig;
  const setConfig = activeTab === "today" ? setTodayConfig : setTomorrowConfig;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xl space-y-6 bg-white rounded-2xl p-6 shadow"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">2지선다 Poll 관리</h1>
          <button
            type="button"
            onClick={() => {
              setIsAuthenticated(false);
              setAdminKey("");
              setInputKey("");
            }}
            className="text-sm text-gray-600 hover:text-black"
          >
            로그아웃
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "today"
                ? "text-black border-b-2 border-black"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            오늘 Poll
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tomorrow")}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === "tomorrow"
                ? "text-black border-b-2 border-black"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            내일 Poll
            {hasTomorrow && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
            )}
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-600">질문</label>
          <input
            value={config.question}
            onChange={(e) => setConfig({ ...config, question: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="예: 민초 vs 반민초"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm text-gray-600">왼쪽 라벨</label>
            <input
              value={config.left.label}
              onChange={(e) => setConfig({ ...config, left: { ...config.left, label: e.target.value } })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="예: 민초"
              required
            />
            <input
              value={config.left.emoji || ""}
              onChange={(e) => setConfig({ ...config, left: { ...config.left, emoji: e.target.value } })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="이모지 (선택)"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-gray-600">오른쪽 라벨</label>
            <input
              value={config.right.label}
              onChange={(e) => setConfig({ ...config, right: { ...config.right, label: e.target.value } })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="예: 반민초"
              required
            />
            <input
              value={config.right.emoji || ""}
              onChange={(e) => setConfig({ ...config, right: { ...config.right, emoji: e.target.value } })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="이모지 (선택)"
            />
          </div>
        </div>

        {/* 오늘 poll 전용 옵션 */}
        {activeTab === "today" && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">현재 투표 현황</span>
              <span className="text-sm font-semibold">
                A: {currentVotes.A} | B: {currentVotes.B}
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={resetVotes}
                onChange={(e) => setResetVotes(e.target.checked)}
                className="rounded"
              />
              투표 수를 0으로 초기화 (새 질문 등록시 권장)
            </label>
          </div>
        )}

        {/* 내일 poll 안내 */}
        {activeTab === "tomorrow" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💡 내일 poll은 자정(00:00)에 자동으로 오늘 poll로 전환됩니다.
              {hasTomorrow && " 현재 내일 poll이 예약되어 있습니다."}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-black text-white py-3 font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "저장 중..." : activeTab === "today" ? "저장" : "예약"}
          </button>
          
          {activeTab === "tomorrow" && hasTomorrow && (
            <button
              type="button"
              onClick={handleDeleteTomorrow}
              disabled={saving}
              className="rounded-lg border border-red-300 text-red-600 px-4 py-3 font-semibold hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
          )}
        </div>

        {message && <p className="text-center text-sm text-gray-600">{message}</p>}
      </form>
    </div>
  );
}
