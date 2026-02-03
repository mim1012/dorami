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
    <div className="bg-content-bg rounded-button p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <Heading2 className="text-hot-pink">Shipping Address</Heading2>
        <Button variant="primary" size="sm" onClick={onEditClick}>
          Edit Address
        </Button>
      </div>

      {address ? (
        <div className="space-y-1">
          <Body className="text-primary-text">{address.fullName}</Body>
          <Body className="text-primary-text">{address.address1}</Body>
          {address.address2 && (
            <Body className="text-primary-text">{address.address2}</Body>
          )}
          <Body className="text-primary-text">
            {address.city}, {address.state} {address.zip}
          </Body>
          <Body className="text-primary-text">Phone: {address.phone}</Body>
        </div>
      ) : (
        <Body className="text-secondary-text">No shipping address set</Body>
      )}
    </div>
  );
}
