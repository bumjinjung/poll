"use client";

import { Poll } from "@/app/data/polls";

interface PollHistoryProps {
  polls: Poll[];
}

export default function PollHistory({ polls }: PollHistoryProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">📜 설문조사 히스토리</h2>
      <div className="space-y-4">
        {polls.map((poll) => {
          const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
          const formattedDate = new Date(poll.date).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

          return (
            <div
              key={poll.id}
              className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">{formattedDate}</p>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {poll.question}
                  </h3>
                  <div className="space-y-2">
                    {poll.options.map((option) => {
                      const percentage =
                        totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                      return (
                        <div key={option.id} className="flex items-center gap-3">
                          <div className="w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12 text-right">
                            {Math.round(percentage)}%
                          </span>
                          <span className="text-sm text-gray-500">({option.votes})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="ml-4 px-3 py-2 bg-blue-100 rounded-lg text-center">
                  <p className="text-xs text-gray-600">총 투표</p>
                  <p className="text-lg font-bold text-blue-600">{totalVotes}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

