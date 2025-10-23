import { getPollHistory } from './kv';

export type PollData = {
  question: string;
  left: { label: string; emoji: string };
  right: { label: string; emoji: string };
};

export type VoteData = {
  A: number;
  B: number;
};

export type PollHistoryItem = {
  date: string;
  poll: PollData | null;
  votes: VoteData;
};

export type HistoryPageResult = {
  items: PollHistoryItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export async function fetchHistoryPage({
  cursor,
  limit = 20
}: {
  cursor?: string | null;
  limit?: number;
}): Promise<HistoryPageResult> {
  try {
    // 전체 히스토리 데이터 가져오기
    const allHistory = await getPollHistory();
    
    // 오늘 제외 + 최신순 정렬
    const now = new Date();
    const kstOffset = 9 * 60; // KST는 UTC+9
    const kstTime = new Date(now.getTime() + kstOffset * 60 * 1000);
    const today = kstTime.toISOString().split('T')[0];

    const filtered = allHistory
      .filter((item) => item.date !== today)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 커서 기반 페이지네이션
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = filtered.findIndex(item => item.date === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const endIndex = startIndex + limit;
    const items = filtered.slice(startIndex, endIndex);
    const hasMore = endIndex < filtered.length;
    const nextCursor = hasMore ? items[items.length - 1]?.date || null : null;

    return {
      items,
      nextCursor,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching history page:', error);
    return {
      items: [],
      nextCursor: null,
      hasMore: false
    };
  }
}
