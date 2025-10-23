import Link from "next/link";

type HeaderProps = {
  itemsCountHint: number;
};

export default function Header({ itemsCountHint }: HeaderProps) {
  return (
    <div className="w-full flex items-center justify-between mb-8 mt-8" style={{ marginBottom: '5px' }}>
      <Link
        href="/"
        className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium flex items-center gap-2"
      >
        <span>←</span>
        <span>홈으로</span>
      </Link>
      <div className="text-center flex-1 hidden sm:block">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">히스토리</h1>
        <p className="text-sm text-gray-500 mt-1">{itemsCountHint}개의 설문</p>
      </div>
      <div className="w-16"></div>
    </div>
  );
}
