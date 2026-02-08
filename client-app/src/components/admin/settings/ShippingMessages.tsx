'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Truck, Save, Eye, EyeOff, Plus } from 'lucide-react';

interface ShippingMessagesData {
  preparing: string;
  shipped: string;
  inTransit: string;
  delivered: string;
}

const STATUS_LABELS: Record<keyof ShippingMessagesData, string> = {
  preparing: '준비중',
  shipped: '발송완료',
  inTransit: '배송중',
  delivered: '배송완료',
};

const VARIABLES = [
  { key: '{orderId}', label: '주문번호' },
  { key: '{trackingNumber}', label: '운송장번호' },
  { key: '{customerName}', label: '고객명' },
];

const DEFAULT_MESSAGES: ShippingMessagesData = {
  preparing: '{customerName}님, 주문번호 {orderId}의 상품을 준비 중입니다.',
  shipped: '{customerName}님, 주문번호 {orderId}의 상품이 발송되었습니다. 운송장번호: {trackingNumber}',
  inTransit: '{customerName}님, 주문번호 {orderId}의 상품이 배송 중입니다. 운송장번호: {trackingNumber}',
  delivered: '{customerName}님, 주문번호 {orderId}의 상품이 배송 완료되었습니다.',
};

export function ShippingMessages() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ShippingMessagesData>(DEFAULT_MESSAGES);
  const [previewKey, setPreviewKey] = useState<keyof ShippingMessagesData | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['shipping-messages'],
    queryFn: async () => {
      const res = await apiClient.get<ShippingMessagesData>('/admin/config/shipping-messages');
      return res.data;
    },
  });

  useEffect(() => {
    if (data) {
      setMessages(data);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (msgs: ShippingMessagesData) => {
      const res = await apiClient.put('/admin/config/shipping-messages', msgs);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-messages'] });
      setIsDirty(false);
    },
  });

  const handleChange = (key: keyof ShippingMessagesData, value: string) => {
    setMessages((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const insertVariable = (key: keyof ShippingMessagesData, variable: string) => {
    const textarea = document.getElementById(`shipping-msg-${key}`) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = messages[key];
    const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
    handleChange(key, newValue);

    // Restore cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const renderPreview = (key: keyof ShippingMessagesData) => {
    let preview = messages[key];
    preview = preview.replace(/\{orderId\}/g, 'ORD-20260207-00001');
    preview = preview.replace(/\{trackingNumber\}/g, '1234567890');
    preview = preview.replace(/\{customerName\}/g, '홍길동');
    return preview;
  };

  const handleSave = () => {
    mutation.mutate(messages);
  };

  const handleReset = () => {
    setMessages(DEFAULT_MESSAGES);
    setIsDirty(true);
  };

  if (isLoading) {
    return (
      <div className="bg-content-bg rounded-button p-6">
        <div className="flex items-center gap-3 mb-4">
          <Truck className="w-6 h-6 text-hot-pink" />
          <Heading2 className="text-primary-text">배송문구 설정</Heading2>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-content-bg rounded-button p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-hot-pink" />
          <Heading2 className="text-primary-text">배송문구 설정</Heading2>
        </div>
        <button
          onClick={handleReset}
          className="text-sm text-secondary-text hover:text-hot-pink transition-colors"
        >
          기본값 복원
        </button>
      </div>

      <Caption className="text-secondary-text block mb-6">
        배송 상태 변경 시 고객에게 전송되는 메시지를 설정합니다. 변수를 활용하여 개인화된 메시지를 작성할 수 있습니다.
      </Caption>

      <div className="space-y-6">
        {(Object.keys(STATUS_LABELS) as (keyof ShippingMessagesData)[]).map((key) => (
          <div key={key} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label
                htmlFor={`shipping-msg-${key}`}
                className="text-body font-semibold text-primary-text"
              >
                {STATUS_LABELS[key]}
              </label>
              <button
                onClick={() => setPreviewKey(previewKey === key ? null : key)}
                className="flex items-center gap-1.5 text-sm text-secondary-text hover:text-hot-pink transition-colors"
              >
                {previewKey === key ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {previewKey === key ? '닫기' : '미리보기'}
              </button>
            </div>

            <textarea
              id={`shipping-msg-${key}`}
              value={messages[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-gray-300 bg-white text-primary-text text-sm resize-y focus:outline-none focus:ring-2 focus:ring-hot-pink focus:border-transparent"
              placeholder={`${STATUS_LABELS[key]} 메시지를 입력하세요`}
            />

            {/* Variable insertion buttons */}
            <div className="flex flex-wrap gap-2 mt-2">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(key, v.key)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-gray-300 rounded-md text-secondary-text hover:border-hot-pink hover:text-hot-pink transition-colors bg-white"
                >
                  <Plus className="w-3 h-3" />
                  {v.label}
                </button>
              ))}
            </div>

            {/* Preview */}
            {previewKey === key && (
              <div className="mt-3 p-3 bg-info-bg border border-info/20 rounded-lg">
                <Caption className="text-info block mb-1 font-semibold">미리보기 (샘플 데이터)</Caption>
                <Body className="text-primary-text text-sm">{renderPreview(key)}</Body>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex justify-end mt-6">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isDirty || mutation.isPending}
        >
          <Save className="w-4 h-4 mr-2" />
          {mutation.isPending ? '저장 중...' : '배송문구 저장'}
        </Button>
      </div>

      {mutation.isSuccess && (
        <div className="mt-3 p-3 bg-success-bg border border-success/20 rounded-lg">
          <Caption className="text-success">배송문구가 저장되었습니다.</Caption>
        </div>
      )}

      {mutation.isError && (
        <div className="mt-3 p-3 bg-error-bg border border-error/20 rounded-lg">
          <Caption className="text-error">저장에 실패했습니다. 다시 시도해주세요.</Caption>
        </div>
      )}
    </div>
  );
}
