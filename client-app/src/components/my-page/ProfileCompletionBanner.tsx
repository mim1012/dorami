'use client';

import { Body } from '@/components/common/Typography';
import type { User } from '@/lib/types/user';
import { isProfileComplete } from '@/lib/utils/profile';
import type { ShippingAddress } from '@/lib/utils/profile';

interface ProfileCompletionBannerProps {
  user: User;
}

function getMissingFields(user: User): string[] {
  const missing: string[] = [];
  if (!user.kakaoPhone) missing.push('전화번호');
  if (!user.email) missing.push('이메일');
  if (!user.instagramId) missing.push('인스타그램 ID');
  const addr = user.shippingAddress as ShippingAddress | undefined;
  if (!addr?.fullName) missing.push('배송지');
  return missing;
}

export function ProfileCompletionBanner({ user }: ProfileCompletionBannerProps) {
  if (isProfileComplete(user)) return null;

  const missing = getMissingFields(user);

  return (
    <div className="bg-hot-pink/10 border border-hot-pink/40 rounded-button p-4 mb-6">
      <div className="flex items-start gap-3">
        <span className="text-hot-pink text-lg leading-none mt-0.5">!</span>
        <div>
          <Body className="text-hot-pink font-semibold mb-1">
            프로필 정보 {missing.length}개가 미입력 상태입니다
          </Body>
          <Body className="text-secondary-text text-caption">
            미입력 항목: {missing.join(', ')}
          </Body>
          <Body className="text-secondary-text text-caption mt-1">
            아래 프로필 정보에서 각 항목의 &apos;등록&apos; 버튼을 눌러 입력해주세요. 장바구니 및
            결제를 이용하려면 모든 항목이 필요합니다.
          </Body>
        </div>
      </div>
    </div>
  );
}
