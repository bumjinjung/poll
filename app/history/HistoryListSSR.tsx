import { PollHistoryItem } from "@/lib/data";
import HistoryItem from "./HistoryItem";

type HistoryListSSRProps = {
  items: PollHistoryItem[];
};

export default function HistoryListSSR({ items }: HistoryListSSRProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-400 text-lg mb-2">아직 히스토리가 없습니다</p>
        <p className="text-gray-400 text-sm">설문이 진행되면 여기에 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {items.map((item, index) => (
        <HistoryItem 
          key={`${item.date}-${index}`} 
          item={item} 
          index={index} 
        />
      ))}
    </div>
  );
}
