'use client';

import { Body, Heading2 } from '@/components/common/Typography';

interface ProfileInfoCardProps {
  instagramId?: string;
  depositorName?: string;
  email?: string;
  nickname: string;
  phone?: string;
  onPhoneEdit?: () => void;
}

export function ProfileInfoCard({
  instagramId,
  depositorName,
  email,
  nickname,
  phone,
  onPhoneEdit,
}: ProfileInfoCardProps) {
  return (
    <div className="bg-content-bg shadow-sm border border-border-color rounded-button p-6 mb-6">
      <Heading2 className="text-hot-pink mb-4">프로필 정보</Heading2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Body className="text-secondary-text text-caption">인스타그램 ID</Body>
          <Body className="text-primary-text">{instagramId || '미설정'}</Body>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">입금자명</Body>
          <Body className="text-primary-text">{depositorName || '미설정'}</Body>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">이메일</Body>
          <Body className="text-primary-text">{email || '미설정'}</Body>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">닉네임</Body>
          <Body className="text-primary-text">{nickname}</Body>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">전화번호 (알림톡)</Body>
          <div className="flex items-center gap-2">
            <Body className="text-primary-text">{phone || '미설정'}</Body>
            {onPhoneEdit && (
              <button
                onClick={onPhoneEdit}
                className="text-hot-pink text-xs underline hover:opacity-80 transition-opacity"
              >
                {phone ? '변경' : '등록'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
