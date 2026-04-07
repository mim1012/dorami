'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { getUserMessage } from '@/lib/errors/error-messages';
import { cartKeys, CartSummary } from '@/lib/hooks/queries/use-cart';
import { usePointBalance } from '@/lib/hooks/queries/use-points';
import { calculateDynamicShipping } from '@/lib/utils/shipping';

interface PointsConfig {
  pointsEnabled: boolean;
  pointEarningRate: number;
  pointMinRedemption: number;
  pointMaxRedemptionPct: number;
}

interface PaymentSettings {
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  zelleEmail: string;
  zelleRecipientName: string;
  venmoEmail: string;
  venmoRecipientName: string;
}

export interface CheckoutFlowState {
  // Data
  pointsConfig: PointsConfig | null;
  paymentSettings: PaymentSettings;
  pointBalance: number;

  // Points UI state
  usePoints: boolean;
  pointsToUse: number;
  maxUsablePoints: number;
  canUsePoints: boolean;
  effectivePointsUsed: number;
  finalTotal: number;
  orderTotal: number;
  orderSubtotal: number;
  shippingFee: number;

  // Terms state
  termsAgreed: boolean;
  privacyAgreed: boolean;

  // Submission state
  isSubmitting: boolean;
  error: string | null;
  isSuccess: boolean;
  orderId: string | null;

  // Actions
  setUsePoints: (value: boolean) => void;
  setPointsToUse: (value: number) => void;
  handleUseAllPoints: () => void;
  handlePointsInputChange: (value: string) => void;
  setTermsAgreed: (value: boolean) => void;
  setPrivacyAgreed: (value: boolean) => void;
  submitOrder: () => Promise<void>;
}

interface UseCheckoutFlowOptions {
  cartData: CartSummary | undefined;
  selectedCartItemIds?: string[];
}

export function useCheckoutFlow({
  cartData,
  selectedCartItemIds,
}: UseCheckoutFlowOptions): CheckoutFlowState {
  const queryClient = useQueryClient();
  const { data: balance } = usePointBalance();
  const idempotencyKeyRef = useRef<string>('');

  const [pointsConfig, setPointsConfig] = useState<PointsConfig | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    bankName: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
    zelleEmail: '',
    zelleRecipientName: '',
    venmoEmail: '',
    venmoRecipientName: '',
  });
  const [usePoints, setUsePointsState] = useState(false);
  const [pointsToUse, setPointsToUseState] = useState(0);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Generate idempotency key on mount
  useEffect(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
  }, []);

  // Load points config and payment settings in parallel
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [pointsResult, paymentResult] = await Promise.allSettled([
        apiClient.get<PointsConfig>('/points/config'),
        apiClient.get<PaymentSettings>('/config/payment'),
      ]);
      if (cancelled) return;
      if (pointsResult.status === 'fulfilled') {
        setPointsConfig(pointsResult.value.data);
      }
      if (paymentResult.status === 'fulfilled') {
        const d = paymentResult.value.data;
        setPaymentSettings({
          bankName: d.bankName || '',
          bankAccountNumber: d.bankAccountNumber || '',
          bankAccountHolder: d.bankAccountHolder || '',
          zelleEmail: d.zelleEmail || '',
          zelleRecipientName: d.zelleRecipientName || '',
          venmoEmail: d.venmoEmail || '',
          venmoRecipientName: d.venmoRecipientName || '',
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived totals — filter by selected items if specified
  const selectedItems = selectedCartItemIds?.length
    ? (cartData?.items?.filter((i) => selectedCartItemIds.includes(i.id)) ?? [])
    : (cartData?.items ?? []);
  const orderSubtotal = selectedCartItemIds?.length
    ? selectedItems.reduce((sum, i) => sum + Math.round(Number(i.price) * 100) * i.quantity, 0) /
      100
    : cartData?.subtotal
      ? parseFloat(cartData.subtotal)
      : 0;
  const shippingFee = calculateDynamicShipping(selectedItems, cartData);
  const orderTotal = orderSubtotal + shippingFee;

  const maxPointsAllowed = pointsConfig
    ? Math.floor(orderTotal * (pointsConfig.pointMaxRedemptionPct / 100))
    : 0;

  const pointBalance = balance?.currentBalance ?? 0;
  const maxUsablePoints = Math.min(pointBalance, maxPointsAllowed);

  const canUsePoints = !!(
    pointsConfig?.pointsEnabled &&
    balance &&
    balance.currentBalance >= (pointsConfig?.pointMinRedemption || 0) &&
    maxUsablePoints > 0
  );

  const effectivePointsUsed = usePoints ? pointsToUse : 0;
  const finalTotal = orderTotal - effectivePointsUsed;

  const setUsePoints = useCallback((value: boolean) => {
    setUsePointsState(value);
    if (!value) setPointsToUseState(0);
  }, []);

  const setPointsToUse = useCallback(
    (value: number) => {
      setPointsToUseState(Math.min(Math.max(0, value), maxUsablePoints));
    },
    [maxUsablePoints],
  );

  const handleUseAllPoints = useCallback(() => {
    setPointsToUseState(maxUsablePoints);
  }, [maxUsablePoints]);

  const handlePointsInputChange = useCallback(
    (value: string) => {
      const num = parseInt(value) || 0;
      setPointsToUseState(Math.min(Math.max(0, num), maxUsablePoints));
    },
    [maxUsablePoints],
  );

  const submitOrder = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const body: { pointsToUse?: number; cartItemIds?: string[] } = {};
      if (usePoints && pointsToUse > 0) {
        body.pointsToUse = pointsToUse;
      }
      if (selectedCartItemIds && selectedCartItemIds.length > 0) {
        body.cartItemIds = selectedCartItemIds;
      }

      const response = await apiClient.post<{ id: string }>('/orders/from-cart', body, {
        headers: { 'Idempotency-Key': idempotencyKeyRef.current },
      });

      setIsSuccess(true);
      setOrderId(response.data.id);
      idempotencyKeyRef.current = crypto.randomUUID();
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    } catch (err: unknown) {
      setError(getUserMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [usePoints, pointsToUse, selectedCartItemIds, queryClient]);

  return {
    pointsConfig,
    paymentSettings,
    pointBalance,
    usePoints,
    pointsToUse,
    maxUsablePoints,
    canUsePoints,
    effectivePointsUsed,
    finalTotal,
    orderTotal,
    orderSubtotal,
    shippingFee,
    termsAgreed,
    privacyAgreed,
    isSubmitting,
    error,
    isSuccess,
    orderId,
    setUsePoints,
    setPointsToUse,
    handleUseAllPoints,
    handlePointsInputChange,
    setTermsAgreed,
    setPrivacyAgreed,
    submitOrder,
  };
}
