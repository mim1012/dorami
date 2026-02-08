'use client';

import { Button } from '@/components/common/Button';
import { Body, Heading2 } from '@/components/common/Typography';

interface ShippingAddress {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

interface ShippingAddressCardProps {
  address?: ShippingAddress;
  onEditClick: () => void;
}

export function ShippingAddressCard({ address, onEditClick }: ShippingAddressCardProps) {
  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-button p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <Heading2 className="text-pink-600">배송지 정보</Heading2>
        <Button variant="primary" size="sm" onClick={onEditClick}>
          수정
        </Button>
      </div>

      {address ? (
        <div className="space-y-1">
          <Body className="text-gray-900">{address.fullName}</Body>
          <Body className="text-gray-900">{address.address1}</Body>
          {address.address2 && (
            <Body className="text-gray-900">{address.address2}</Body>
          )}
          <Body className="text-gray-900">
            {address.city}, {address.state} {address.zip}
          </Body>
          <Body className="text-gray-900">연락처: {address.phone}</Body>
        </div>
      ) : (
        <Body className="text-gray-500">등록된 배송지가 없습니다</Body>
      )}
    </div>
  );
}
