'use client';

import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Button } from '@/components/common/Button';
import { Body } from '@/components/common/Typography';
import { US_STATES } from '@/lib/constants/us-states';
import { formatPhoneNumber, formatZipCode } from '@/lib/utils/format';

export interface AddressFormData {
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

interface AddressEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: AddressFormData;
  onSubmit: (data: AddressFormData) => Promise<void>;
}

export function AddressEditModal({
  isOpen,
  onClose,
  initialData,
  onSubmit,
}: AddressEditModalProps) {
  const [formData, setFormData] = useState<AddressFormData>(initialData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'phone') {
      formattedValue = formatPhoneNumber(value);
    } else if (name === 'zip') {
      formattedValue = formatZipCode(value);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(formData);
      handleClose();
    } catch (error: any) {
      setSubmitError(
        error.response?.data?.message || 'Failed to update address. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitError(null);
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Shipping Address" maxWidth="lg">
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
          <Button type="button" variant="outline" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
