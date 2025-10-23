"use client";

import { useState } from "react";

interface PollOptionProps {
  text: string;
  isSelected: boolean;
  isVoted: boolean;
  votes: number;
  totalVotes: number;
  onSelect: () => void;
}

export default function PollOption({
  text,
  isSelected,
  isVoted,
  votes,
  totalVotes,
  onSelect,
}: PollOptionProps) {
  const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;

  return (
    <div
      className={`relative w-full p-4 rounded-lg cursor-pointer transition-all duration-300 border-2 ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
      onClick={onSelect}
    >
      {/* 투표율 배경 바 */}
      {isVoted && (
        <div
          className="absolute left-0 top-0 h-full bg-blue-200 opacity-30 rounded-lg transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      )}

      <div className="relative z-10 flex items-center justify-between">
        <span className="text-lg font-medium text-gray-800">{text}</span>
        {isVoted && (
          <span className="text-sm font-semibold text-blue-600">
            {Math.round(percentage)}%
          </span>
        )}
      </div>

      {/* 투표 수 표시 */}
      {isVoted && (
        <div className="relative z-10 mt-2 text-xs text-gray-500">
          {votes}명 투표
        </div>
      )}
    </div>
  );
}

