'use client';

import { useEffect, useState, Suspense } from 'react';
import { getRuntimeConfig } from '@/lib/config/runtime';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { isProfileComplete } from '@/lib/utils/profile';
import { Display, Body } from '@/components/common/Typography';
import Image from 'next/image';

const POST_LOGIN_RETURN_KEY = 'doremi_post_login_return_to';

function sanitizeReturnPath(raw: string | null): string {
  if (!raw) return '/';
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/')) return '/';
    if (decoded.startsWith('//')) return '/';
    return decoded;
  } catch {
    return '/';
  }
}

function getReturnToFromSearchParams(searchParams: URLSearchParams): string {
  return sanitizeReturnPath(searchParams.get('returnTo') || searchParams.get('redirect'));
}

function consumeStoredReturnTo(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(POST_LOGIN_RETURN_KEY);
  window.localStorage.removeItem(POST_LOGIN_RETURN_KEY);
  return sanitizeReturnPath(stored);
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, isSessionVerified, isVerifying, refreshProfile, user } =
    useAuth();

  const error = searchParams.get('error');
  const reason = searchParams.get('reason');
  const [devEmail, setDevEmail] = useState('');
  const [devRole, setDevRole] = useState<'USER' | 'ADMIN'>('USER');
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState('');
  const [isDevAuthEnabled, setIsDevAuthEnabled] = useState(process.env.NODE_ENV === 'development');
  const [returnTo, setReturnTo] = useState('');
  const hasExplicitReturnTo = searchParams.has('returnTo') || searchParams.has('redirect');

  useEffect(() => {
    if (hasExplicitReturnTo) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(POST_LOGIN_RETURN_KEY);
      }
      setReturnTo(getReturnToFromSearchParams(searchParams));
      return;
    }

    setReturnTo(consumeStoredReturnTo() || '');
  }, [searchParams, hasExplicitReturnTo]);

  useEffect(() => {
    if (!user || !isAuthenticated || isLoading || isVerifying || !isSessionVerified) return;

    if (user.role !== 'ADMIN' && !isProfileComplete(user)) {
      router.push('/profile/register');
      return;
    }

    // All users can login without profile completion (instagramId/depositorName not required)
    const target = hasExplicitReturnTo ? getReturnToFromSearchParams(searchParams) : returnTo;
    const safeTarget = user.role === 'USER' && target.startsWith('/admin') ? '/' : target;

    if (safeTarget) {
      router.push(safeTarget);
    } else {
      router.push('/');
    }
  }, [
    hasExplicitReturnTo,
    isAuthenticated,
    isLoading,
    isSessionVerified,
    isVerifying,
    returnTo,
    router,
    searchParams,
    user,
  ]);

  useEffect(() => {
    // In local dev always show dev login
    if (process.env.NODE_ENV === 'development') return;
    getRuntimeConfig().then(({ enableDevAuth }) => setIsDevAuthEnabled(enableDevAuth));
  }, []);

  const handleKakaoLogin = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(POST_LOGIN_RETURN_KEY, returnTo);
    }
    const callback = `/api/auth/kakao`;
    window.location.href = callback;
  };

  const handleDevLogin = async () => {
    if (!devEmail) return;
    setDevLoading(true);
    setDevError('');
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: devEmail }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setDevError(errData.message || `로그인 실패 (${res.status})`);
        return;
      }
      const data = await res.json();
      // Refresh auth state and redirect
      await refreshProfile();
      const userData = data.data?.user;

      if (returnTo) {
        const safeReturnTo =
          userData?.role === 'USER' && returnTo.startsWith('/admin') ? '/' : returnTo;
        router.push(safeReturnTo);
        return;
      }

      if (userData?.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setDevError(err.message || '서버 연결 실패');
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-black flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden bg-white">
            <Image
              src="/logo.png"
              alt="Doremi"
              width={64}
              height={64}
              className="object-contain w-full h-full"
              unoptimized
              priority
            />
          </div>
          <Display className="text-hot-pink mb-2">Doremi</Display>
          <Body className="text-secondary-text">라이브 쇼핑의 새로운 경험</Body>
        </div>

        {reason === 'session_expired' && (
          <div className="bg-warning-bg border border-warning/30 rounded-lg p-4">
            <Body className="text-warning text-sm">
              로그인 세션이 만료되었습니다. 다시 로그인해주세요.
            </Body>
          </div>
        )}

        {error && (
          <div className="bg-error-bg border border-error/30 rounded-lg p-4">
            <Body className="text-error text-sm">
              로그인 중 오류가 발생했습니다. 다시 시도해주세요.
            </Body>
          </div>
        )}

        <div className="bg-content-bg rounded-3xl p-8 border border-border-color space-y-6">
          <button
            onClick={handleKakaoLogin}
            className="w-full h-14 rounded-2xl bg-[#FEE500] text-[#191919] font-semibold text-base transition-transform active:scale-[0.99]"
          >
            카카오로 시작하기
          </button>

          {isDevAuthEnabled && (
            <div className="border-t border-border-color pt-6 space-y-3">
              <div className="text-xs text-secondary-text">개발용 로그인</div>
              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 rounded-xl bg-primary-black border border-border-color px-4 outline-none focus:border-hot-pink"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDevRole('USER')}
                  className={`flex-1 h-10 rounded-xl border ${
                    devRole === 'USER'
                      ? 'border-hot-pink text-hot-pink'
                      : 'border-border-color text-secondary-text'
                  }`}
                >
                  USER
                </button>
                <button
                  type="button"
                  onClick={() => setDevRole('ADMIN')}
                  className={`flex-1 h-10 rounded-xl border ${
                    devRole === 'ADMIN'
                      ? 'border-hot-pink text-hot-pink'
                      : 'border-border-color text-secondary-text'
                  }`}
                >
                  ADMIN
                </button>
              </div>
              <button
                type="button"
                onClick={handleDevLogin}
                disabled={devLoading || !devEmail}
                className="w-full h-11 rounded-xl bg-hot-pink text-white disabled:opacity-50"
              >
                {devLoading ? '로그인 중...' : '개발 로그인'}
              </button>
              {devError && <Body className="text-error text-sm">{devError}</Body>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary-black flex items-center justify-center text-secondary-text">
          로딩 중...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
