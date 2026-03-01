'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { Display, Body } from '@/components/common/Typography';
import Image from 'next/image';

const POST_LOGIN_RETURN_KEY = 'dorami_post_login_return_to';

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
  const { isAuthenticated, isLoading, refreshProfile, user } = useAuth();

  const error = searchParams.get('error');
  const reason = searchParams.get('reason');
  const [devEmail, setDevEmail] = useState('');
  const [devRole, setDevRole] = useState<'USER' | 'ADMIN'>('USER');
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState('');
  const [isDevAuthEnabled, setIsDevAuthEnabled] = useState(false);
  const [returnTo, setReturnTo] = useState('/');
  const hasExplicitReturnTo = searchParams.has('returnTo') || searchParams.has('redirect');

  useEffect(() => {
    if (hasExplicitReturnTo) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(POST_LOGIN_RETURN_KEY);
      }
      setReturnTo(getReturnToFromSearchParams(searchParams));
      return;
    }

    setReturnTo(consumeStoredReturnTo() || '/');
  }, [searchParams, hasExplicitReturnTo]);

  useEffect(() => {
    if (!user || !isAuthenticated || isLoading) return;

    const needsProfile = !user.instagramId || !user.depositorName;
    const target = hasExplicitReturnTo ? getReturnToFromSearchParams(searchParams) : returnTo;
    const safeTarget = user.role === 'USER' && target.startsWith('/admin') ? '/' : target;

    if (needsProfile) {
      router.push('/profile/register');
    } else if (safeTarget) {
      router.push(safeTarget);
    } else {
      router.push('/');
    }
  }, [hasExplicitReturnTo, isAuthenticated, isLoading, returnTo, router, searchParams, user]);

  useEffect(() => {
    // 런타임에 체크 (docker-entrypoint.sh가 플레이스홀더를 치환한 후 실행됨)
    const val = String(process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH || '');
    setIsDevAuthEnabled(val === 'true');
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
      if (returnTo) {
        if (userData?.role === 'ADMIN') {
          router.push(returnTo);
          return;
        }

        const safeReturnTo =
          userData?.role === 'USER' && returnTo.startsWith('/admin') ? '/' : returnTo;

        if (userData && (!userData.instagramId || !userData.depositorName)) {
          router.push('/profile/register');
          return;
        }

        router.push(safeReturnTo);
        return;
      }

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
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden">
            <Image
              src="/logo.png"
              alt="Doremi"
              width={64}
              height={64}
              className="object-contain w-full h-full"
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
        {isDevAuthEnabled && (
          <div className="pt-4 border-t border-border-color">
            <div className="p-4 bg-content-bg rounded-lg border border-border-color space-y-3">
              <p className="text-xs text-secondary-text">스테이징 테스트 전용</p>

              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="이메일 (예: admin@doremi.shop)"
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
                    setDevEmail('admin@doremi.shop');
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
