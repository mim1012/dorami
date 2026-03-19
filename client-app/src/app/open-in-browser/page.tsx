'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="w-full py-3 px-6 bg-pink-500 text-white rounded-xl font-semibold text-base active:opacity-80"
    >
      {copied ? '복사됨!' : 'URL 복사하기'}
    </button>
  );
}

function OpenInBrowserContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url') ?? '';

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-white">
      <div className="max-w-sm w-full flex flex-col items-center gap-6 text-center">
        <div className="text-5xl">📱</div>
        <h1 className="text-xl font-bold">외부 브라우저에서 열어주세요</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          인스타그램 앱 내부 브라우저에서는 일부 기능이 제한됩니다.
          <br />
          아래 URL을 복사해 Safari 또는 Chrome에서 열어주세요.
        </p>
        <div className="w-full bg-gray-900 rounded-xl p-3 text-xs text-gray-300 break-all text-left select-all">
          {url || window.location.origin}
        </div>
        <CopyButton url={url || window.location.origin} />
        <p className="text-xs text-gray-500">Safari에서 주소창에 붙여넣기 후 이동하시면 됩니다.</p>
      </div>
    </main>
  );
}

export default function OpenInBrowserPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black flex items-center justify-center text-white">
          <p>로딩 중...</p>
        </main>
      }
    >
      <OpenInBrowserContent />
    </Suspense>
  );
}
