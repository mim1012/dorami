'use client';

interface SocialProofProps {
  followerCount: number;
  message?: string;
}

export function SocialProof({ followerCount, message = '믿고 머물 수 있는, 기준 있는 쇼핑공간' }: SocialProofProps) {
  return (
    <div className="mx-4 mb-6 p-4 rounded-xl bg-content-bg border border-border-color text-center">
      <p className="text-sm text-secondary-text mb-2">{message}</p>
      <p className="text-2xl font-bold text-hot-pink">
        {followerCount.toLocaleString()}명 단골!
      </p>
    </div>
  );
}
