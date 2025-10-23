"use client";

import { useState, useEffect } from "react";
import { Poll } from "@/app/data/polls";
import PollOption from "./PollOption";

interface PollCardProps {
  poll: Poll;
}

export default function PollCard({ poll }: PollCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isVoted, setIsVoted] = useState(false);
  const [pollData, setPollData] = useState(poll);

  // 로컬 스토리지에서 투표 정보 로드
  useEffect(() => {
    const savedVote = localStorage.getItem(`poll-${poll.id}`);
    if (savedVote) {
      const { optionId, votes } = JSON.parse(savedVote);
      setSelectedOption(optionId);
      setIsVoted(true);

      // 저장된 투표 데이터 반영
      const updatedPoll = {
        ...pollData,
        options: pollData.options.map((opt) => ({
          ...opt,
          votes: votes[opt.id] || 0,
        })),
      };
      setPollData(updatedPoll);
    }
  }, [poll.id, pollData]);

  const handleVote = (optionId: number) => {
    if (isVoted) return;

    setSelectedOption(optionId);
    setIsVoted(true);

    // 투표 결과 업데이트
    const updatedOptions = pollData.options.map((opt) => {
      if (opt.id === optionId) {
        return { ...opt, votes: opt.votes + 1 };
      }
      return opt;
    });

    const updatedPoll = { ...pollData, options: updatedOptions };
    setPollData(updatedPoll);

    // 로컬 스토리지에 저장
    const voteData = {
      optionId,
      votes: Object.fromEntries(updatedOptions.map((opt) => [opt.id, opt.votes])),
    };
    localStorage.setItem(`poll-${poll.id}`, JSON.stringify(voteData));
  };

  const totalVotes = pollData.options.reduce((sum, opt) => sum + opt.votes, 0);
  const formattedDate = new Date(pollData.date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8 text-center">
        <p className="text-sm text-gray-500 mb-2">📅 {formattedDate}</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {pollData.question}
        </h1>
        <p className="text-gray-600">
          총 <span className="font-semibold text-blue-600">{totalVotes}</span>명이
          투표했습니다
        </p>
      </div>

      {/* 선택지 */}
      <div className="space-y-3">
        {pollData.options.map((option) => (
          <PollOption
            key={option.id}
            text={option.text}
            isSelected={selectedOption === option.id}
            isVoted={isVoted}
            votes={option.votes}
            totalVotes={totalVotes}
            onSelect={() => handleVote(option.id)}
          />
        ))}
      </div>

      {/* 투표 완료 메시지 */}
      {isVoted && (
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-green-700 font-medium">✓ 투표해주셨습니다!</p>
          <p className="text-sm text-green-600 mt-1">
            내일 새로운 설문조사를 기다려주세요 🎉
          </p>
        </div>
      )}

      {/* 투표 안내 */}
      {!isVoted && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-blue-700 font-medium">위 선택지 중 하나를 선택해주세요</p>
        </div>
      )}
    </div>
  );
}

