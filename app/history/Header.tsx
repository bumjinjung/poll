import Link from "next/link";

export default function Header() {
  return (
    <div className="w-full mb-8 mt-8" style={{ marginBottom: '5px' }}>
      <Link
        href="/"
        className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium flex items-center gap-2"
      >
        <span>←</span>
        <span>홈으로</span>
      </Link>
    </div>
  );
}
