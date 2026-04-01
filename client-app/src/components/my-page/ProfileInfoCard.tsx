'use client';

import { Body, Heading2 } from '@/components/common/Typography';
import { formatPhoneNumberForInput, inferPhoneRegion } from '@/lib/utils/format';

interface ProfileInfoCardProps {
  instagramId?: string;
  depositorName?: string;
  email?: string;
  nickname: string;
  kakaoPhone?: string;
  onPhoneEdit?: () => void;
  onInstagramIdEdit?: () => void;
  onDepositorNameEdit?: () => void;
  onEmailEdit?: () => void;
}

export function ProfileInfoCard({
  instagramId,
  depositorName,
  email,
  nickname,
  kakaoPhone,
  onPhoneEdit,
  onInstagramIdEdit,
  onDepositorNameEdit,
  onEmailEdit,
}: ProfileInfoCardProps) {
  return (
    <div className="bg-content-bg shadow-sm border border-border-color rounded-button p-6 mb-6">
      <Heading2 className="text-hot-pink mb-4">프로필 정보</Heading2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Body className="text-secondary-text text-caption">인스타그램 ID</Body>
          <div className="flex items-center gap-2 min-w-0">
            <Body className="text-primary-text truncate min-w-0">{instagramId || '미설정'}</Body>
            {onInstagramIdEdit && (
              <button
                onClick={onInstagramIdEdit}
                className="text-hot-pink text-xs underline hover:opacity-80 transition-opacity flex-shrink-0"
              >
                {instagramId ? '변경' : '등록'}
              </button>
            )}
          </div>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">입금자명</Body>
          <div className="flex items-center gap-2">
            <Body className="text-primary-text">{depositorName || '미설정'}</Body>
            {onDepositorNameEdit && (
              <button
                onClick={onDepositorNameEdit}
                className="text-hot-pink text-xs underline hover:opacity-80 transition-opacity"
              >
                {depositorName ? '변경' : '등록'}
              </button>
            )}
          </div>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">이메일</Body>
          <div className="flex items-center gap-2">
            <Body className="text-primary-text">{email || '미설정'}</Body>
            {onEmailEdit && (
              <button
                onClick={onEmailEdit}
                className="text-hot-pink text-xs underline hover:opacity-80 transition-opacity"
              >
                {email ? '변경' : '등록'}
              </button>
            )}
          </div>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">닉네임</Body>
          <Body className="text-primary-text">{nickname}</Body>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">카카오톡 전화번호</Body>
          <div className="flex items-center gap-2">
            <Body className="text-primary-text">
              {kakaoPhone
                ? formatPhoneNumberForInput(kakaoPhone, inferPhoneRegion(kakaoPhone))
                : '미설정'}
            </Body>
            {onPhoneEdit && (
              <button
                onClick={onPhoneEdit}
                className="text-hot-pink text-xs underline hover:opacity-80 transition-opacity"
              >
                {kakaoPhone ? '변경' : '등록'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
