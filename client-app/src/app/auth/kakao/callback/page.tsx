'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function KakaoCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const profileComplete = searchParams.get('profileComplete') === 'true';
    const kakaoName = searchParams.get('kakaoName');

    if (profileComplete) {
      router.replace('/');
    } else {
      const params = new URLSearchParams({ incomplete: 'true' });
      if (kakaoName) {
        params.set('kakaoName', kakaoName);
      }
      router.replace(`/my-page?${params.toString()}`);
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-primary-black flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
    </div>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
        </div>
      }
    >
      <KakaoCallbackHandler />
    </Suspense>
  );
}
