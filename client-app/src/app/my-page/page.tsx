'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Display, Body, Heading2 } from '@/components/common/Typography';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { US_STATES } from '@/lib/constants/us-states';
import { formatPhoneNumber, formatZipCode } from '@/lib/utils/format';

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

interface AddressFormData {
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

interface FormErrors {
  fullName?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}

export default function MyPagePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const [formData, setFormData] = useState<AddressFormData>({
    fullName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // [DEV] Redirect all users to admin page
  useEffect(() => {
    router.push('/admin');
  }, [router]);

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const response = await apiClient.get<ProfileData>('/users/profile/me');
        setProfile(response.data);

        // Pre-fill form with current address
        if (response.data.shippingAddress) {
          setFormData({
            fullName: response.data.shippingAddress.fullName,
            address1: response.data.shippingAddress.address1,
            address2: response.data.shippingAddress.address2 || '',
            city: response.data.shippingAddress.city,
            state: response.data.shippingAddress.state,
            zip: response.data.shippingAddress.zip,
            phone: response.data.shippingAddress.phone,
          });
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let formattedValue = value;

    // Apply auto-formatting
    if (name === 'phone') {
      formattedValue = formatPhoneNumber(value);
    } else if (name === 'zip') {
      formattedValue = formatZipCode(value);
    } else if (name === 'state') {
      formattedValue = value.toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [name]: formattedValue }));

    // Clear error for this field
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.address1.trim()) {
      newErrors.address1 = 'Address is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state) {
      newErrors.state = 'State is required';
    }

    if (!formData.zip) {
      newErrors.zip = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.zip)) {
      newErrors.zip = 'ZIP code must be in format 12345 or 12345-6789';
    }

    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(formData.phone)) {
      newErrors.phone = 'Phone number must be complete';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleKakaoLogin = () => {
    if (!agreedToTerms || !agreedToPrivacy) {
      alert('이용약관과 개인정보처리방침에 동의해주세요.');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const baseUrl = apiUrl.replace('/api', '');
    window.location.href = `${baseUrl}/auth/kakao`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await apiClient.patch<ProfileData>('/users/profile/address', formData);
      setProfile(response.data);
      setIsEditModalOpen(false);
      setSuccessMessage('Address updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Address update error:', error);
      setSubmitError(
        error.response?.data?.message || 'Failed to update address. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || (user && isLoadingProfile)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body>Loading...</Body>
      </div>
    );
  }

  // If not logged in, show a basic page with login modal
  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-white py-12 px-4 pb-24">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <Display className="text-hot-pink mb-2">My Page</Display>
              <Body className="text-secondary-text">로그인하여 프로필을 확인하세요</Body>
            </div>
          </div>
        </div>

        {/* Login Modal */}
        <Modal
          isOpen={isLoginModalOpen}
          onClose={() => router.push('/')}
          title="로그인이 필요합니다"
          maxWidth="md"
        >
          <div className="space-y-6">
            <div className="text-center">
              <Body className="text-secondary-text">
                카카오 계정으로 간편하게 시작하세요
              </Body>
            </div>

            {/* 약관 동의 */}
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

            {/* 카카오 로그인 버튼 - 타원형 */}
            <button
              onClick={handleKakaoLogin}
              className="w-full bg-[#FEE500] text-[#000000] hover:bg-[#FEE500]/90 font-bold py-4 rounded-full text-body transition-opacity"
            >
              💬 3초만에 로그인
            </button>

            <Body className="text-center text-secondary-text text-caption">
              로그인하면 위 약관에 동의하는 것으로 간주됩니다
            </Body>
          </div>
        </Modal>

        <BottomTabBar />
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <div className="min-h-screen bg-white flex items-center justify-center pb-24">
          <Body className="text-error">Failed to load profile</Body>
        </div>
        <BottomTabBar />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white py-12 px-4 pb-24">
        <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <Display className="text-hot-pink mb-2">My Page</Display>
          <Body className="text-secondary-text">Manage your profile and view orders</Body>
        </div>

        {successMessage && (
          <div className="bg-success/10 border border-success rounded-button p-4 mb-6">
            <Body className="text-success">{successMessage}</Body>
          </div>
        )}

        {/* Profile Information */}
        <div className="bg-content-bg rounded-button p-6 mb-6">
          <Heading2 className="text-hot-pink mb-4">Profile Information</Heading2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Body className="text-secondary-text text-caption">Instagram ID</Body>
              <Body className="text-primary-text">
                {profile.instagramId || 'Not set'}
              </Body>
            </div>

            <div>
              <Body className="text-secondary-text text-caption">Depositor Name</Body>
              <Body className="text-primary-text">
                {profile.depositorName || 'Not set'}
              </Body>
            </div>

            <div>
              <Body className="text-secondary-text text-caption">Email</Body>
              <Body className="text-primary-text">{profile.email}</Body>
            </div>

            <div>
              <Body className="text-secondary-text text-caption">Nickname</Body>
              <Body className="text-primary-text">{profile.nickname}</Body>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-content-bg rounded-button p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Heading2 className="text-hot-pink">Shipping Address</Heading2>
            <Button variant="primary" size="sm" onClick={() => setIsEditModalOpen(true)}>
              Edit Address
            </Button>
          </div>

          {profile.shippingAddress ? (
            <div className="space-y-1">
              <Body className="text-primary-text">{profile.shippingAddress.fullName}</Body>
              <Body className="text-primary-text">{profile.shippingAddress.address1}</Body>
              {profile.shippingAddress.address2 && (
                <Body className="text-primary-text">{profile.shippingAddress.address2}</Body>
              )}
              <Body className="text-primary-text">
                {profile.shippingAddress.city}, {profile.shippingAddress.state}{' '}
                {profile.shippingAddress.zip}
              </Body>
              <Body className="text-primary-text">Phone: {profile.shippingAddress.phone}</Body>
            </div>
          ) : (
            <Body className="text-secondary-text">No shipping address set</Body>
          )}
        </div>

        {/* Admin Dashboard Access - Only visible for ADMIN role */}
        {profile.role === 'ADMIN' && (
          <div className="bg-content-bg rounded-button p-6 mb-6 border-2 border-hot-pink">
            <div className="flex items-center justify-between mb-4">
              <Heading2 className="text-hot-pink">판매자 전용</Heading2>
              <div className="bg-hot-pink text-primary-text px-3 py-1 rounded-button text-caption font-bold">
                ADMIN
              </div>
            </div>
            <Body className="text-secondary-text mb-4">
              라이브 방송 관리, 주문 처리, 채팅 모더레이션 등 판매자 전용 기능에 접근할 수 있습니다.
            </Body>
            <Button
              variant="primary"
              fullWidth
              onClick={() => router.push('/admin')}
            >
              🎯 판매자 대시보드 시작하기 →
            </Button>
          </div>
        )}

        {/* Order History Summary */}
        <div className="bg-content-bg rounded-button p-6">
          <div className="flex items-center justify-between mb-4">
            <Heading2 className="text-hot-pink">주문 내역</Heading2>
            <Button variant="outline" size="sm" onClick={() => router.push('/orders')}>
              전체 보기
            </Button>
          </div>
          <Body className="text-secondary-text mb-4">
            주문하신 상품의 배송 상태를 확인하세요
          </Body>
          <Button
            variant="primary"
            fullWidth
            onClick={() => router.push('/orders')}
          >
            📦 내 주문 확인하기 →
          </Button>
        </div>
      </div>

      {/* Edit Address Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSubmitError(null);
          setErrors({});
        }}
        title="Edit Shipping Address"
        maxWidth="lg"
      >
        {submitError && (
          <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
            <Body className="text-error">{submitError}</Body>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            error={errors.fullName}
            placeholder="First and Last Name"
            fullWidth
            required
          />

          <Input
            label="Address Line 1"
            name="address1"
            value={formData.address1}
            onChange={handleChange}
            error={errors.address1}
            placeholder="Street address, P.O. box, company name"
            fullWidth
            required
          />

          <Input
            label="Address Line 2 (Optional)"
            name="address2"
            value={formData.address2}
            onChange={handleChange}
            placeholder="Apartment, suite, unit, building, floor, etc."
            fullWidth
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
              error={errors.city}
              placeholder="City"
              fullWidth
              required
            />

            <Select
              label="State"
              name="state"
              value={formData.state}
              onChange={handleChange}
              error={errors.state}
              options={US_STATES.map((state) => ({
                value: state.code,
                label: `${state.code} - ${state.name}`,
              }))}
              placeholder="Select state"
              fullWidth
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="ZIP Code"
              name="zip"
              value={formData.zip}
              onChange={handleChange}
              error={errors.zip}
              placeholder="12345 or 12345-6789"
              fullWidth
              required
            />

            <Input
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              error={errors.phone}
              placeholder="(123) 456-7890"
              fullWidth
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => {
                setIsEditModalOpen(false);
                setSubmitError(null);
                setErrors({});
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
      </div>

      <BottomTabBar />
    </>
  );
}
