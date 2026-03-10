'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import { Display, Body } from '@/components/common/Typography';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import {
  ProfileInfoCard,
  ShippingAddressCard,
  AdminDashboardCard,
  OrderHistoryCard,
  PointsBalanceCard,
  AddressEditModal,
  ProfileCompletionBanner,
  type AddressFormData,
} from '@/components/my-page';

interface ShippingAddress {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
}

interface ProfileData {
  id: string;
  kakaoId: string;
  email?: string;
  nickname: string;
  profileImage?: string;
  role: string;
  depositorName?: string;
  instagramId?: string;
  kakaoPhone?: string;
  shippingAddress?: ShippingAddress;
  createdAt: string;
  updatedAt: string;
}

export default function MyPagePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPhoneEditOpen, setIsPhoneEditOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isInstagramIdEditOpen, setIsInstagramIdEditOpen] = useState(false);
  const [instagramIdInput, setInstagramIdInput] = useState('');
  const [instagramIdError, setInstagramIdError] = useState<string | null>(null);
  const [isDepositorNameEditOpen, setIsDepositorNameEditOpen] = useState(false);
  const [depositorNameInput, setDepositorNameInput] = useState('');
  const [depositorNameError, setDepositorNameError] = useState<string | null>(null);
  const [isEmailEditOpen, setIsEmailEditOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [addressFormData, setAddressFormData] = useState<AddressFormData>({
    fullName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
  });

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const response = await apiClient.get<ProfileData>('/users/profile/me');
        setProfile(response.data);
        prefillAddressForm(response.data.shippingAddress);
      } catch (error) {
        console.error('Failed to load profile:', error);
        setProfile(user as any);
        prefillAddressForm(user.shippingAddress as ShippingAddress | undefined);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [user]);

  const prefillAddressForm = (address?: ShippingAddress) => {
    if (address) {
      setAddressFormData({
        fullName: address.fullName,
        address1: address.address1,
        address2: address.address2 || '',
        city: address.city,
        state: address.state,
        zip: address.zip,
      });
    }
  };

  const handleAddressSubmit = async (data: AddressFormData) => {
    const response = await apiClient.patch<ProfileData>('/users/profile/address', data);
    setProfile(response.data);
    setSuccessMessage('배송지가 저장되었습니다');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handlePhoneEdit = () => {
    setPhoneInput(profile?.kakaoPhone || '');
    setPhoneError(null);
    setIsPhoneEditOpen(true);
  };

  const handlePhoneSubmit = async () => {
    if (
      !/^(\+1|1)?[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}$|^(\+82|0)\d{8,11}$/.test(
        phoneInput.replace(/\s/g, ''),
      )
    ) {
      setPhoneError(
        '미국 번호 (예: +1 213-555-1234) 또는 한국 번호 (예: 010-1234-5678)를 입력해주세요',
      );
      return;
    }
    try {
      const response = await apiClient.patch<ProfileData>('/users/me', { kakaoPhone: phoneInput });
      setProfile(response.data);
      setIsPhoneEditOpen(false);
      setSuccessMessage('전화번호가 저장되었습니다');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setPhoneError('저장에 실패했습니다. 다시 시도해주세요');
    }
  };

  const handleInstagramIdEdit = () => {
    setInstagramIdInput(profile?.instagramId || '');
    setInstagramIdError(null);
    setIsInstagramIdEditOpen(true);
  };

  const handleInstagramIdSubmit = async () => {
    const trimmed = instagramIdInput.trim();
    if (!trimmed || trimmed === '@') {
      setInstagramIdError('인스타그램 ID를 입력해주세요');
      return;
    }
    if (!/^@[a-zA-Z0-9._]+$/.test(trimmed)) {
      setInstagramIdError('올바른 인스타그램 ID 형식이 아닙니다');
      return;
    }
    try {
      const response = await apiClient.patch<ProfileData>('/users/me', { instagramId: trimmed });
      setProfile(response.data);
      setIsInstagramIdEditOpen(false);
      setSuccessMessage('인스타그램 ID가 저장되었습니다');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setInstagramIdError('저장에 실패했습니다. 다시 시도해주세요');
    }
  };

  const handleDepositorNameEdit = () => {
    setDepositorNameInput(profile?.depositorName || '');
    setDepositorNameError(null);
    setIsDepositorNameEditOpen(true);
  };

  const handleEmailEdit = () => {
    setEmailInput(profile?.email || '');
    setEmailError(null);
    setIsEmailEditOpen(true);
  };

  const handleEmailSubmit = async () => {
    const trimmed = emailInput.trim();
    if (!trimmed) {
      setEmailError('이메일을 입력해주세요');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('올바른 이메일 형식이 아닙니다');
      return;
    }
    try {
      const response = await apiClient.patch<ProfileData>('/users/me', { email: trimmed });
      setProfile(response.data);
      setIsEmailEditOpen(false);
      setSuccessMessage('이메일이 저장되었습니다');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 409) {
        setEmailError('이미 사용 중인 이메일입니다');
      } else {
        setEmailError('저장에 실패했습니다. 다시 시도해주세요');
      }
    }
  };

  const handleDepositorNameSubmit = async () => {
    const trimmed = depositorNameInput.trim();
    if (!trimmed) {
      setDepositorNameError('입금자명을 입력해주세요');
      return;
    }
    try {
      const response = await apiClient.patch<ProfileData>('/users/me', { depositorName: trimmed });
      setProfile(response.data);
      setIsDepositorNameEditOpen(false);
      setSuccessMessage('입금자명이 저장되었습니다');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setDepositorNameError('저장에 실패했습니다. 다시 시도해주세요');
    }
  };

  // Loading state (auth + profile guard + profile data)
  if (authLoading || (user && isLoadingProfile)) {
    return (
      <>
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
        </div>
        <BottomTabBar />
      </>
    );
  }

  if (!user) {
    return null;
  }

  // Admin users are redirected to admin dashboard
  if (user.role === 'ADMIN') {
    router.replace('/admin');
    return null;
  }

  if (!profile) {
    return (
      <>
        <div className="min-h-screen bg-primary-black flex items-center justify-center pb-bottom-nav">
          <Body className="text-error">프로필을 불러올 수 없습니다</Body>
        </div>
        <BottomTabBar />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-primary-black py-6 sm:py-12 px-4 pb-bottom-nav">
        <div className="w-full md:max-w-4xl md:mx-auto">
          <div className="text-center mb-8">
            <Display className="text-hot-pink mb-2">마이페이지</Display>
            <Body className="text-secondary-text">프로필 관리 및 주문 내역 확인</Body>
          </div>

          {successMessage && (
            <div className="bg-success/10 border border-success rounded-lg p-4 mb-6">
              <Body className="text-success">{successMessage}</Body>
            </div>
          )}

          <ProfileCompletionBanner user={user} />

          <ProfileInfoCard
            instagramId={profile.instagramId}
            depositorName={profile.depositorName}
            email={profile.email}
            nickname={profile.nickname}
            kakaoPhone={profile.kakaoPhone}
            onPhoneEdit={handlePhoneEdit}
            onInstagramIdEdit={handleInstagramIdEdit}
            onDepositorNameEdit={handleDepositorNameEdit}
            onEmailEdit={handleEmailEdit}
          />

          <PointsBalanceCard />

          <ShippingAddressCard
            address={profile.shippingAddress}
            onEditClick={() => setIsEditModalOpen(true)}
          />

          {profile.role === 'ADMIN' && <AdminDashboardCard />}

          <OrderHistoryCard />

          {/* 로그아웃 버튼 */}
          <div className="mt-6">
            <button
              onClick={logout}
              className="w-full py-3 text-secondary-text text-sm border border-border-color rounded-lg hover:bg-content-bg transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>

        <AddressEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialData={addressFormData}
          onSubmit={handleAddressSubmit}
        />

        {isPhoneEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-content-bg border border-border-color rounded-button p-6 w-[calc(100%-2rem)] max-w-sm">
              <Body className="text-primary-text font-semibold mb-4">
                카카오톡에 등록된 전화번호
              </Body>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setPhoneError(null);
                }}
                placeholder="+1 213-555-1234 또는 010-1234-5678"
                className="w-full bg-primary-black border border-border-color rounded-button px-4 py-3 text-primary-text placeholder-secondary-text focus:outline-none focus:border-hot-pink mb-2"
              />
              {phoneError && <Body className="text-error text-caption mb-2">{phoneError}</Body>}
              <Body className="text-secondary-text text-caption mb-4">
                카카오톡에 등록된 전화번호를 입력해주세요 (미국: +1 213-555-1234 / 한국:
                010-1234-5678)
              </Body>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsPhoneEditOpen(false)}
                  className="flex-1 py-3 border border-border-color rounded-button text-secondary-text text-sm hover:bg-primary-black transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handlePhoneSubmit}
                  className="flex-1 py-3 bg-hot-pink rounded-button text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {isInstagramIdEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-content-bg border border-border-color rounded-button p-6 w-[calc(100%-2rem)] max-w-sm">
              <Body className="text-primary-text font-semibold mb-4">인스타그램 ID 등록</Body>
              <input
                type="text"
                value={instagramIdInput}
                onChange={(e) => {
                  setInstagramIdInput(e.target.value);
                  setInstagramIdError(null);
                }}
                placeholder="@username"
                className="w-full bg-primary-black border border-border-color rounded-button px-4 py-3 text-primary-text placeholder-secondary-text focus:outline-none focus:border-hot-pink mb-2"
              />
              {instagramIdError && (
                <Body className="text-error text-caption mb-2">{instagramIdError}</Body>
              )}
              <Body className="text-secondary-text text-caption mb-4">
                @로 시작하는 인스타그램 ID를 입력해주세요 (예: @username)
              </Body>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsInstagramIdEditOpen(false)}
                  className="flex-1 py-3 border border-border-color rounded-button text-secondary-text text-sm hover:bg-primary-black transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleInstagramIdSubmit}
                  className="flex-1 py-3 bg-hot-pink rounded-button text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {isEmailEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-content-bg border border-border-color rounded-button p-6 w-[calc(100%-2rem)] max-w-sm">
              <Body className="text-primary-text font-semibold mb-4">이메일 변경</Body>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setEmailError(null);
                }}
                placeholder="example@email.com"
                className="w-full bg-primary-black border border-border-color rounded-button px-4 py-3 text-primary-text placeholder-secondary-text focus:outline-none focus:border-hot-pink mb-2"
              />
              {emailError && <Body className="text-error text-caption mb-2">{emailError}</Body>}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setIsEmailEditOpen(false)}
                  className="flex-1 py-3 border border-border-color rounded-button text-secondary-text text-sm hover:bg-primary-black transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleEmailSubmit}
                  className="flex-1 py-3 bg-hot-pink rounded-button text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {isDepositorNameEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-content-bg border border-border-color rounded-button p-6 w-[calc(100%-2rem)] max-w-sm">
              <Body className="text-primary-text font-semibold mb-4">입금자명 등록</Body>
              <input
                type="text"
                value={depositorNameInput}
                onChange={(e) => {
                  setDepositorNameInput(e.target.value);
                  setDepositorNameError(null);
                }}
                placeholder="입금자 이름"
                className="w-full bg-primary-black border border-border-color rounded-button px-4 py-3 text-primary-text placeholder-secondary-text focus:outline-none focus:border-hot-pink mb-2"
              />
              {depositorNameError && (
                <Body className="text-error text-caption mb-2">{depositorNameError}</Body>
              )}
              <Body className="text-secondary-text text-caption mb-4">
                송금받을 때 표시될 입금자명을 입력해주세요
              </Body>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDepositorNameEditOpen(false)}
                  className="flex-1 py-3 border border-border-color rounded-button text-secondary-text text-sm hover:bg-primary-black transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleDepositorNameSubmit}
                  className="flex-1 py-3 bg-hot-pink rounded-button text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomTabBar />
    </>
  );
}
