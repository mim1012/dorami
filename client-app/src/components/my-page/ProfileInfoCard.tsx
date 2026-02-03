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
    <div className="bg-content-bg rounded-button p-6 mb-6">
      <Heading2 className="text-hot-pink mb-4">Profile Information</Heading2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Body className="text-secondary-text text-caption">Instagram ID</Body>
          <Body className="text-primary-text">{instagramId || 'Not set'}</Body>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">Depositor Name</Body>
          <Body className="text-primary-text">{depositorName || 'Not set'}</Body>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">Email</Body>
          <Body className="text-primary-text">{email || 'Not set'}</Body>
        </div>

        <div>
          <Body className="text-secondary-text text-caption">Nickname</Body>
          <Body className="text-primary-text">{nickname}</Body>
        </div>
      </div>
    </div>
  );
}
