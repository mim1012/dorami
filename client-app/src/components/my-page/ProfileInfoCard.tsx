'use client';

import { Body, Heading2 } from '@/components/common/Typography';

interface ProfileInfoCardProps {
  instagramId?: string;
  depositorName?: string;
  email?: string;
  nickname: string;
}

export function ProfileInfoCard({
  instagramId,
  depositorName,
  email,
  nickname,
}: ProfileInfoCardProps) {
  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-button p-6 mb-6">
      <Heading2 className="text-pink-600 mb-4">프로필 정보</Heading2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Body className="text-gray-500 text-caption">인스타그램 ID</Body>
          <Body className="text-gray-900">{instagramId || '미설정'}</Body>
        </div>

        <div>
          <Body className="text-gray-500 text-caption">입금자명</Body>
          <Body className="text-gray-900">{depositorName || '미설정'}</Body>
        </div>

        <div>
          <Body className="text-gray-500 text-caption">이메일</Body>
          <Body className="text-gray-900">{email || '미설정'}</Body>
        </div>

        <div>
          <Body className="text-gray-500 text-caption">닉네임</Body>
          <Body className="text-gray-900">{nickname}</Body>
        </div>
      </div>
    </div>
  );
}
