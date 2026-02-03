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
  AddressEditModal,
  LoginRequiredModal,
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
  const { user, isLoading: authLoading } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
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
    setSuccessMessage('Address updated successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  if (authLoading || (user && isLoadingProfile)) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Body>Loading...</Body>
      </div>
    );
  }

  // Not logged in state
  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-[#121212] py-12 px-4 pb-28">
          <div className="w-full md:max-w-4xl md:mx-auto">
            <div className="text-center mb-8">
              <Display className="text-hot-pink mb-2">My Page</Display>
              <Body className="text-secondary-text">로그인하여 프로필을 확인하세요</Body>
            </div>
          </div>
        </div>
        <LoginRequiredModal isOpen={isLoginModalOpen} onClose={() => router.push('/')} />
        <BottomTabBar />
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <div className="min-h-screen bg-[#121212] flex items-center justify-center pb-28">
          <Body className="text-error">Failed to load profile</Body>
        </div>
        <BottomTabBar />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#121212] py-12 px-4 pb-28">
        <div className="w-full md:max-w-4xl md:mx-auto">
          <div className="text-center mb-8">
            <Display className="text-hot-pink mb-2">My Page</Display>
            <Body className="text-secondary-text">Manage your profile and view orders</Body>
          </div>

          {successMessage && (
            <div className="bg-success/10 border border-success rounded-button p-4 mb-6">
              <Body className="text-success">{successMessage}</Body>
            </div>
          )}

          <ProfileInfoCard
            instagramId={profile.instagramId}
            depositorName={profile.depositorName}
            email={profile.email}
            nickname={profile.nickname}
          />

          <ShippingAddressCard
            address={profile.shippingAddress}
            onEditClick={() => setIsEditModalOpen(true)}
          />

          {profile.role === 'ADMIN' && <AdminDashboardCard />}

          <OrderHistoryCard />
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
