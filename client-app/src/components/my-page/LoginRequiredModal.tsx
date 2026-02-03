'use client';

import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Body } from '@/components/common/Typography';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginRequiredModal({ isOpen, onClose }: LoginRequiredModalProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const handleKakaoLogin = () => {
    if (!agreedToTerms || !agreedToPrivacy) {
      alert('이용약관과 개인정보처리방침에 동의해주세요.');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const baseUrl = apiUrl.replace('/api', '');
    window.location.href = `${baseUrl}/auth/kakao`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="로그인이 필요합니다" maxWidth="md">
      <div className="space-y-6">
        <div className="text-center">
          <Body className="text-secondary-text">카카오 계정으로 간편하게 시작하세요</Body>
        </div>

        <div className="space-y-3 bg-content-bg rounded-button p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-hot-pink bg-white checked:bg-hot-pink focus:ring-hot-pink focus:ring-2 cursor-pointer"
            />
            <div className="flex-1">
              <Body className="text-primary-text">
                <span className="text-hot-pink font-bold">[필수]</span> 이용약관 동의
              </Body>
              <Body className="text-caption text-secondary-text mt-1">
                서비스 이용을 위한 기본 약관에 동의합니다.
              </Body>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToPrivacy}
              onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-hot-pink bg-white checked:bg-hot-pink focus:ring-hot-pink focus:ring-2 cursor-pointer"
            />
            <div className="flex-1">
              <Body className="text-primary-text">
                <span className="text-hot-pink font-bold">[필수]</span> 개인정보처리방침 동의
              </Body>
              <Body className="text-caption text-secondary-text mt-1">
                개인정보 수집 및 이용에 동의합니다.
              </Body>
            </div>
          </label>
        </div>

        <button
          onClick={handleKakaoLogin}
          className="w-full bg-[#FEE500] text-[#000000] hover:bg-[#FEE500]/90 font-bold py-4 rounded-full text-body transition-opacity"
        >
          3초만에 로그인
        </button>

        <Body className="text-center text-secondary-text text-caption">
          로그인하면 위 약관에 동의하는 것으로 간주됩니다
        </Body>
      </div>
    </Modal>
  );
}
