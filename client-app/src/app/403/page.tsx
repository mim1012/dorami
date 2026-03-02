'use client';

import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-primary-black text-primary-text flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-hot-pink mb-4">403</h1>
        <h2 className="text-2xl font-semibold mb-2">접근 권한 없음</h2>
        <p className="text-secondary-text mb-8">
          해당 페이지에 접근할 수 있는 권한이 없습니다. 관리자 계정으로 로그인하세요.
        </p>
        <Link
          href="/"
          className="inline-block bg-hot-pink hover:bg-hot-pink/80 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
