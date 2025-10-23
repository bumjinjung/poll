import Link from "next/link";
import { pollsData } from "@/app/data/polls";

export default function HistoryPage() {
  // 역순으로 정렬 (최신순)
  const sortedPolls = [...pollsData].reverse();

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-12 px-4">
      {/* 뒤로가기 */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-gray-500 hover:text-gray-700 transition-colors text-sm"
      >
        ← 홈으로
      </Link>

      {/* 헤더 */}
      <div className="mb-12 text-center w-full">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">히스토리</h1>
        <p className="text-gray-500 text-sm">총 {pollsData.length}개의 설문조사</p>
      </div>

      {/* 설문조사 히스토리 */}
      <div className="w-full max-w-3xl space-y-4">
        {sortedPolls.map((poll) => {
          const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
          const formattedDate = new Date(poll.date).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

          return (
            <div
              key={poll.id}
              className="p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-2">{formattedDate}</p>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {poll.question}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">총 투표</p>
                  <p className="text-2xl font-bold text-gray-800">{totalVotes}</p>
                </div>
              </div>

              <div className="space-y-3">
                {poll.options.map((option) => {
                  const percentage =
                    totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                  return (
                    <div key={option.id} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">{option.text}</span>
                          <span className="text-sm font-semibold text-gray-600">
                            {Math.round(percentage)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

