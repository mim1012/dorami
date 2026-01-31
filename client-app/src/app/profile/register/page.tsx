'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
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
  const { user, isLoading: authLoading } = useAuth();

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

  const { isChecking: checkingInstagram, isAvailable: instagramAvailable } =
    useInstagramCheck(formData.instagramId);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let formattedValue = value;

    // Apply auto-formatting
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

    // Clear error for this field
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Depositor Name
    if (!formData.depositorName.trim()) {
      newErrors.depositorName = 'Depositor name is required';
    }

    // Instagram ID
    if (!formData.instagramId.trim() || formData.instagramId === '@') {
      newErrors.instagramId = 'Instagram ID is required';
    } else if (!/^@[a-zA-Z0-9._]+$/.test(formData.instagramId)) {
      newErrors.instagramId = 'Invalid Instagram ID format';
    } else if (instagramAvailable === false) {
      newErrors.instagramId = 'This Instagram ID is already registered';
    }

    // Full Name
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    // Address
    if (!formData.address1.trim()) {
      newErrors.address1 = 'Address is required';
    }

    // City
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    // State
    if (!formData.state) {
      newErrors.state = 'State is required';
    }

    // ZIP
    if (!formData.zip) {
      newErrors.zip = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.zip)) {
      newErrors.zip = 'ZIP code must be in format 12345 or 12345-6789';
    }

    // Phone
    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(formData.phone)) {
      newErrors.phone = 'Phone number must be complete';
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
      router.push('/');
    } catch (error: any) {
      console.error('Profile completion error:', error);
      setSubmitError(
        error.response?.data?.message ||
          'Failed to complete profile. Please check your information and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body>Loading...</Body>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Display className="text-hot-pink mb-2">Complete Your Profile</Display>
          <Body className="text-secondary-text">
            We need a few more details to complete your registration
          </Body>
        </div>

        {submitError && (
          <div className="bg-error/10 border border-error rounded-button p-4 mb-6">
            <Body className="text-error">{submitError}</Body>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Section */}
          <div className="bg-content-bg rounded-button p-6 space-y-4">
            <Heading2 className="text-hot-pink mb-4">Basic Information</Heading2>

            <Input
              label="Depositor Name (입금자명)"
              name="depositorName"
              value={formData.depositorName}
              onChange={handleChange}
              error={errors.depositorName}
              placeholder="Name used for bank transfers"
              fullWidth
              required
            />

            <div>
              <Input
                label="Instagram ID"
                name="instagramId"
                value={formData.instagramId}
                onChange={handleChange}
                error={errors.instagramId}
                placeholder="@username"
                fullWidth
                required
              />
              {checkingInstagram && (
                <Body className="text-secondary-text text-caption mt-1">
                  Checking availability...
                </Body>
              )}
              {!checkingInstagram && instagramAvailable === true && formData.instagramId.length > 1 && (
                <Body className="text-success text-caption mt-1">✓ Available</Body>
              )}
              {!checkingInstagram && instagramAvailable === false && (
                <Body className="text-error text-caption mt-1">✗ Already taken</Body>
              )}
            </div>
          </div>

          {/* Shipping Address Section */}
          <div className="bg-content-bg rounded-button p-6 space-y-4">
            <Heading2 className="text-hot-pink mb-4">Shipping Address</Heading2>

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
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={isSubmitting || checkingInstagram || instagramAvailable === false}
          >
            {isSubmitting ? 'Completing Profile...' : 'Complete Profile'}
          </Button>
        </form>
      </div>
    </div>
  );
}
