"use client";

import { useEffect, useState } from "react";

type Config = {
  question: string;
  left: { label: string; emoji?: string };
  right: { label: string; emoji?: string };
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("dev-admin");
  const [config, setConfig] = useState<Config>({
    question: "",
    left: { label: "" },
    right: { label: "" },
  });
  const [resetVotes, setResetVotes] = useState(false);
  const [currentVotes, setCurrentVotes] = useState({ A: 0, B: 0 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/today", { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (res?.data) setConfig(res.data);
        if (res?.votes) setCurrentVotes(res.votes);
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/today", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ ...config, resetVotesFlag: resetVotes }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("저장되었습니다. 메인 페이지를 새로고침하세요.");
        if (resetVotes) {
          setCurrentVotes({ A: 0, B: 0 });
          setResetVotes(false);
        }
      } else {
        setMessage(data.message || "저장 실패");
      }
    } catch (err) {
      setMessage("오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xl space-y-6 bg-white rounded-2xl p-6 shadow"
      >
        <h1 className="text-2xl font-semibold">오늘의 2지선다 설정</h1>

        <div className="space-y-2">
          <label className="block text-sm text-gray-600">관리자 키</label>
          <input
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="dev-admin 또는 환경변수 ADMIN_KEY"
          />
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

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-black text-white py-3 font-semibold hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>

        {message && <p className="text-center text-sm text-gray-600">{message}</p>}
      </form>
    </div>
  );
}
