'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

interface PointAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentBalance: number;
  onSuccess: () => void;
}

export function PointAdjustmentModal({
  isOpen,
  onClose,
  userId,
  currentBalance,
  onSuccess,
}: PointAdjustmentModalProps) {
  const [type, setType] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resultBalance = type === 'add'
    ? currentBalance + amount
    : currentBalance - amount;

  const isValid =
    amount > 0 &&
    reason.length >= 10 &&
    (type === 'add' || resultBalance >= 0);

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/admin/users/${userId}/points/adjust`, {
        type,
        amount,
        reason,
      });

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Failed to adjust points:', err);
      setError(err.message || 'Failed to adjust points');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setType('add');
    setAmount(0);
    setReason('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-button p-6 max-w-md w-full mx-4">
        <Heading2 className="text-hot-pink mb-4">Adjust Points</Heading2>

        {error && (
          <div className="bg-error/10 border border-error rounded-button p-3 mb-4">
            <Caption className="text-error">{error}</Caption>
          </div>
        )}

        <div className="space-y-4">
          {/* Current Balance */}
          <div className="bg-gray-50 rounded-button p-3">
            <Caption className="text-secondary-text">Current Balance</Caption>
            <Body className="text-hot-pink font-bold text-lg">
              {new Intl.NumberFormat('ko-KR').format(currentBalance)} P
            </Body>
          </div>

          {/* Type Selection */}
          <div>
            <Caption className="text-secondary-text mb-2 block">Adjustment Type</Caption>
            <div className="flex gap-3">
              <label className="flex-1">
                <input
                  type="radio"
                  name="adjustType"
                  value="add"
                  checked={type === 'add'}
                  onChange={() => setType('add')}
                  className="sr-only"
                />
                <div
                  className={`p-3 rounded-button border-2 text-center cursor-pointer transition-colors ${
                    type === 'add'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-secondary-text'
                  }`}
                >
                  <Body className="font-medium">+ Add</Body>
                </div>
              </label>
              <label className="flex-1">
                <input
                  type="radio"
                  name="adjustType"
                  value="subtract"
                  checked={type === 'subtract'}
                  onChange={() => setType('subtract')}
                  className="sr-only"
                />
                <div
                  className={`p-3 rounded-button border-2 text-center cursor-pointer transition-colors ${
                    type === 'subtract'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-secondary-text'
                  }`}
                >
                  <Body className="font-medium">- Subtract</Body>
                </div>
              </label>
            </div>
          </div>

          {/* Amount */}
          <Input
            label="Amount"
            type="number"
            min={1}
            value={amount || ''}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            placeholder="Enter point amount"
            fullWidth
          />

          {/* Reason */}
          <div>
            <Input
              label="Reason (min. 10 characters)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason for this adjustment"
              fullWidth
            />
            {reason.length > 0 && reason.length < 10 && (
              <Caption className="text-error mt-1">
                Reason must be at least 10 characters ({reason.length}/10)
              </Caption>
            )}
          </div>

          {/* Result Preview */}
          {amount > 0 && (
            <div className="bg-gray-50 rounded-button p-3">
              <Caption className="text-secondary-text">Result After Adjustment</Caption>
              <Body
                className={`font-bold text-lg ${
                  resultBalance >= 0 ? 'text-primary-text' : 'text-error'
                }`}
              >
                {new Intl.NumberFormat('ko-KR').format(currentBalance)}{' '}
                <span className={type === 'add' ? 'text-green-600' : 'text-red-600'}>
                  {type === 'add' ? '+' : '-'} {new Intl.NumberFormat('ko-KR').format(amount)}
                </span>{' '}
                = {new Intl.NumberFormat('ko-KR').format(resultBalance)} P
              </Body>
              {resultBalance < 0 && (
                <Caption className="text-error">
                  Cannot subtract more than current balance
                </Caption>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-6">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Processing...' : 'Confirm'}
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
