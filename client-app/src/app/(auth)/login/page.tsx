'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { Display, Body } from '@/components/common/Typography';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, refreshProfile } = useAuth();

  const error = searchParams.get('error');
  const [devEmail, setDevEmail] = useState('');
  const [devRole, setDevRole] = useState<'USER' | 'ADMIN'>('USER');
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState('');

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleKakaoLogin = () => {
    window.location.href = '/api/v1/auth/kakao';
  };

  const handleDevLogin = async () => {
    if (!devEmail) return;
    setDevLoading(true);
    setDevError('');
    try {
      const res = await fetch('/api/v1/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: devEmail, role: devRole }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setDevError(errData.message || `로그인 실패 (${res.status})`);
        return;
      }
      const data = await res.json();
      // Refresh auth state and redirect based on profile completion
      await refreshProfile();
      const userData = data.data?.user;
      if (userData?.role === 'ADMIN') {
        router.push('/admin');
      } else if (userData && (!userData.instagramId || !userData.depositorName)) {
        router.push('/profile/register');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setDevError(err.message || '서버 연결 실패');
    } finally {
      setDevLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-black flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-hot-pink flex items-center justify-center shadow-hot-pink">
            <span className="text-white font-black text-2xl">D</span>
          </div>
          <Display className="text-hot-pink mb-2">DoRaMi</Display>
          <Body className="text-secondary-text">라이브 쇼핑의 새로운 경험</Body>
        </div>

        {error && (
          <div className="bg-error-bg border border-error/30 rounded-lg p-4">
            <Body className="text-error text-sm">
              {error === 'auth_failed'
                ? '인증에 실패했습니다. 다시 시도해주세요.'
                : '오류가 발생했습니다. 다시 시도해주세요.'}
            </Body>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleKakaoLogin}
            className="w-full flex items-center justify-center gap-2 bg-[#FEE500] text-[#191919] py-3.5 rounded-lg font-bold text-base hover:bg-[#FEE500]/90 transition-all active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
              <path d="M12 3C6.48 3 2 6.48 2 10.5c0 2.55 1.69 4.8 4.24 6.12-.18.67-.67 2.42-.77 2.8-.12.47.17.46.36.34.15-.1 2.37-1.6 3.34-2.25.6.09 1.21.13 1.83.13 5.52 0 10-3.48 10-7.64C22 6.48 17.52 3 12 3z" />
            </svg>
            카카오로 로그인
          </button>

          <Body className="text-center text-secondary-text text-xs">
            로그인 시 이용약관 및 개인정보 처리방침에 동의합니다
          </Body>
        </div>

        {/* Dev Login Section — only rendered when NEXT_PUBLIC_ENABLE_DEV_AUTH=true */}
        {process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === 'true' && (
          <div className="pt-4 border-t border-border-color">
            <div className="p-4 bg-content-bg rounded-lg border border-border-color space-y-3">
              <p className="text-xs text-secondary-text">스테이징 테스트 전용</p>

              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="이메일 (예: admin@dorami.shop)"
                className="w-full px-3 py-2.5 bg-primary-black border border-border-color rounded-lg text-sm text-primary-text placeholder:text-secondary-text/50 focus:border-hot-pink focus:outline-none"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setDevRole('USER')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    devRole === 'USER'
                      ? 'bg-hot-pink text-white'
                      : 'bg-primary-black text-secondary-text border border-border-color'
                  }`}
                >
                  일반 사용자
                </button>
                <button
                  onClick={() => setDevRole('ADMIN')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    devRole === 'ADMIN'
                      ? 'bg-hot-pink text-white'
                      : 'bg-primary-black text-secondary-text border border-border-color'
                  }`}
                >
                  관리자
                </button>
              </div>

              {/* Quick login buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDevEmail('buyer@test.com');
                    setDevRole('USER');
                  }}
                  className="flex-1 py-1.5 text-xs rounded bg-info/10 text-info border border-info/20 hover:bg-info/20 transition-colors"
                >
                  구매자 계정
                </button>
                <button
                  onClick={() => {
                    setDevEmail('admin@dorami.shop');
                    setDevRole('ADMIN');
                  }}
                  className="flex-1 py-1.5 text-xs rounded bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition-colors"
                >
                  관리자 계정
                </button>
              </div>

              {devError && <p className="text-xs text-error">{devError}</p>}

              <button
                onClick={handleDevLogin}
                disabled={devLoading || !devEmail}
                className="w-full py-2.5 bg-hot-pink text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-40 active:scale-[0.98]"
              >
                {devLoading ? '로그인 중...' : '테스트 로그인'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
