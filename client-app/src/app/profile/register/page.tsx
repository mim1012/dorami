'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/store/auth';
import { useInstagramCheck } from '@/lib/hooks/use-instagram-check';
import { formatPhoneNumber, formatZipCode, formatInstagramId } from '@/lib/utils/format';
import { US_STATES } from '@/lib/constants/us-states';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Display, Body, Heading2 } from '@/components/common/Typography';

interface FormData {
  depositorName: string;
  instagramId: string;
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

interface FormErrors {
  depositorName?: string;
  instagramId?: string;
  fullName?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}

export default function ProfileRegisterPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, refreshProfile } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    depositorName: '',
    instagramId: '',
    fullName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (submitError && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [submitError]);

  const { isChecking: checkingInstagram, isAvailable: instagramAvailable } = useInstagramCheck(
    formData.instagramId,
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 이미 프로필이 완성된 유저가 이 페이지에 오면 홈으로 이동
  useEffect(() => {
    if (!authLoading && user?.instagramId && user?.depositorName) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let formattedValue = value;

    if (name === 'phone') {
      formattedValue = formatPhoneNumber(value);
    } else if (name === 'zip') {
      formattedValue = formatZipCode(value);
    } else if (name === 'instagramId') {
      formattedValue = formatInstagramId(value);
    } else if (name === 'state') {
      formattedValue = value.toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [name]: formattedValue }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.depositorName.trim()) {
      newErrors.depositorName = '입금자명을 입력해주세요';
    }

    if (!formData.instagramId.trim() || formData.instagramId === '@') {
      newErrors.instagramId = '인스타그램 ID를 입력해주세요';
    } else if (!/^@[a-zA-Z0-9._]+$/.test(formData.instagramId)) {
      newErrors.instagramId = '올바른 인스타그램 ID 형식이 아닙니다';
    } else if (instagramAvailable === false) {
      newErrors.instagramId = '이미 등록된 인스타그램 ID입니다';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = '수령인 이름을 입력해주세요';
    }

    if (!formData.address1.trim()) {
      newErrors.address1 = '주소를 입력해주세요';
    }

    if (!formData.city.trim()) {
      newErrors.city = '도시명을 입력해주세요';
    }

    if (!formData.state) {
      newErrors.state = 'State를 선택해주세요';
    }

    if (!formData.zip) {
      newErrors.zip = 'ZIP Code를 입력해주세요';
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.zip)) {
      newErrors.zip = 'ZIP Code 형식: 12345 또는 12345-6789';
    }

    if (!formData.phone) {
      newErrors.phone = '전화번호를 입력해주세요';
    } else if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(formData.phone)) {
      newErrors.phone = '미국 전화번호 형식: (123) 456-7890';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await apiClient.post('/users/complete-profile', formData);
      await refreshProfile();
      // refreshProfile은 실패해도 throw하지 않으므로, 스토어 상태를 직접 확인
      const updatedUser = useAuthStore.getState().user;
      if (!updatedUser?.instagramId || !updatedUser?.depositorName) {
        setSubmitError('프로필 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      router.push('/');
    } catch (error: any) {
      console.error('Profile completion error:', error);
      setSubmitError(
        error.message || '프로필 등록에 실패했습니다. 정보를 확인 후 다시 시도해주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-black py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Display className="text-hot-pink mb-2">프로필 등록</Display>
          <Body className="text-secondary-text">서비스 이용을 위해 추가 정보를 입력해주세요</Body>
        </div>

        {submitError && (
          <div ref={errorRef} className="bg-error/10 border border-error rounded-lg p-4 mb-6">
            <Body className="text-error">{submitError}</Body>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 */}
          <div className="bg-content-bg rounded-xl p-6 space-y-4">
            <Heading2 className="text-hot-pink mb-4">기본 정보</Heading2>

            <Input
              label="입금자명"
              name="depositorName"
              value={formData.depositorName}
              onChange={handleChange}
              error={errors.depositorName}
              placeholder="Zelle 입금 시 사용하는 이름"
              fullWidth
              required
            />

            <div>
              <Input
                label="인스타그램 ID"
                name="instagramId"
                value={formData.instagramId}
                onChange={handleChange}
                error={errors.instagramId}
                placeholder="@username"
                fullWidth
                required
              />
              {checkingInstagram && (
                <Body className="text-secondary-text text-xs mt-1">확인 중...</Body>
              )}
              {!checkingInstagram &&
                instagramAvailable === true &&
                formData.instagramId.length > 1 && (
                  <Body className="text-success text-xs mt-1">사용 가능</Body>
                )}
              {!checkingInstagram && instagramAvailable === false && (
                <Body className="text-error text-xs mt-1">이미 사용 중인 ID입니다</Body>
              )}
            </div>
          </div>

          {/* 미국 배송지 정보 */}
          <div className="bg-content-bg rounded-xl p-6 space-y-4">
            <Heading2 className="text-hot-pink mb-4">미국 배송지</Heading2>

            <Input
              label="수령인 (Full Name)"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              error={errors.fullName}
              placeholder="First and Last Name"
              fullWidth
              required
            />

            <Input
              label="주소 (Address Line 1)"
              name="address1"
              value={formData.address1}
              onChange={handleChange}
              error={errors.address1}
              placeholder="Street address, P.O. box"
              fullWidth
              required
            />

            <Input
              label="상세 주소 (Address Line 2)"
              name="address2"
              value={formData.address2}
              onChange={handleChange}
              placeholder="Apt, Suite, Unit, Floor (선택)"
              fullWidth
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="도시 (City)"
                name="city"
                value={formData.city}
                onChange={handleChange}
                error={errors.city}
                placeholder="City"
                fullWidth
                required
              />

              <Select
                label="주 (State)"
                name="state"
                value={formData.state}
                onChange={handleChange}
                error={errors.state}
                options={US_STATES.map((state) => ({
                  value: state.code,
                  label: `${state.code} - ${state.name}`,
                }))}
                placeholder="State 선택"
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
                placeholder="12345 또는 12345-6789"
                fullWidth
                required
              />

              <Input
                label="전화번호 (미국)"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={errors.phone}
                placeholder="(123) 456-7890"
                fullWidth
                required
              />
            </div>
          </div>

          {/* 등록 버튼 */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={isSubmitting || instagramAvailable === false}
          >
            {isSubmitting ? '등록 중...' : '프로필 등록 완료'}
          </Button>
        </form>
      </div>
    </div>
  );
}
