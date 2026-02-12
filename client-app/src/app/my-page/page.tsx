'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useProfileGuard } from '@/lib/hooks/use-profile-guard';
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
  type AddressFormData,
} from '@/components/my-page';

interface ShippingAddress {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
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
  shippingAddress?: ShippingAddress;
  createdAt: string;
  updatedAt: string;
}

export default function MyPagePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { isLoading: guardLoading, isProfileComplete } = useProfileGuard();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [addressFormData, setAddressFormData] = useState<AddressFormData>({
    fullName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
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
        phone: address.phone,
      });
    }
  };

  const handleAddressSubmit = async (data: AddressFormData) => {
    const response = await apiClient.patch<ProfileData>('/users/profile/address', data);
    setProfile(response.data);
    setSuccessMessage('배송지가 저장되었습니다');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Loading state (auth + profile guard + profile data)
  if (authLoading || guardLoading || (user && isLoadingProfile)) {
    return (
      <>
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
        </div>
        <BottomTabBar />
      </>
    );
  }

  // useProfileGuard handles redirect for non-authenticated and incomplete profile
  // Admin users skip profile completion requirement
  if (!user || (user.role !== 'ADMIN' && !isProfileComplete)) {
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
      <div className="min-h-screen bg-primary-black py-12 px-4 pb-bottom-nav">
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

          <ProfileInfoCard
            instagramId={profile.instagramId}
            depositorName={profile.depositorName}
            email={profile.email}
            nickname={profile.nickname}
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
      </div>

      <BottomTabBar />
    </>
  );
}
