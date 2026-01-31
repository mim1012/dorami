'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/common/Button';
import { Display, Body } from '@/components/common/Typography';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  const error = searchParams.get('error');

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleKakaoLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const baseUrl = apiUrl.replace('/api', '');
    window.location.href = `${baseUrl}/auth/kakao`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body>Loading...</Body>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Display className="text-hot-pink mb-2">Live Commerce</Display>
          <Body className="text-secondary-text">
            Log in to access exclusive live shopping experiences
          </Body>
        </div>

        {error && (
          <div className="bg-error/10 border border-error rounded-button p-4">
            <Body className="text-error">
              {error === 'auth_failed'
                ? 'Authentication failed. Please try again.'
                : 'An error occurred. Please try again.'}
            </Body>
          </div>
        )}

        <div className="space-y-4">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleKakaoLogin}
            className="bg-[#FEE500] text-[#000000] hover:bg-[#FEE500]/90"
          >
            Login with Kakao
          </Button>

          <Body className="text-center text-secondary-text text-caption">
            By logging in, you agree to our Terms of Service and Privacy Policy
          </Body>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Body>Loading...</Body>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
