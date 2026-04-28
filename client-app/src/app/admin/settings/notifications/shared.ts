import { NOTIFICATION_VARIABLES, type NotificationEventType } from '@live-commerce/shared-types';

export type KakaoDeliveryStatus = 'sent' | 'failed' | 'skipped';
export type KakaoMessageChannel = 'AT' | 'FT';

export interface KakaoDeliveryResult {
  status: KakaoDeliveryStatus;
  channel: KakaoMessageChannel;
  recipient: string;
  providerCode?: string;
  providerMessage?: string;
  providerMessageKey?: string;
  reason?: string;
}

export interface KakaoDeliveryBatchResult {
  results: KakaoDeliveryResult[];
  totals: {
    sent: number;
    failed: number;
    skipped: number;
  };
}

export interface TestDeliveryResponse {
  phone: string;
  result: KakaoDeliveryBatchResult;
}

export const TEST_ENDPOINTS: Record<NotificationEventType, string> = {
  ORDER_CONFIRMATION: '/admin/alimtalk/test-order',
  PAYMENT_REMINDER: '/admin/alimtalk/test-payment-reminder',
  CART_EXPIRING: '/admin/alimtalk/test-cart-expiring',
  LIVE_START: '/admin/alimtalk/test-live',
};

export function formatDeliveryStatus(status: KakaoDeliveryStatus) {
  switch (status) {
    case 'sent':
      return '발송 성공';
    case 'failed':
      return '발송 실패';
    case 'skipped':
      return '발송 건너뜀';
  }
}

export function formatDeliveryReason(reason?: string) {
  switch (reason) {
    case 'disabled':
      return '알림톡 기능이 비활성화되어 있습니다.';
    case 'provider_unavailable':
      return 'Bizgo 연동이 준비되지 않았습니다.';
    case 'template_missing':
      return '템플릿 본문이 설정되지 않았습니다.';
    case 'template_code_missing':
      return '카카오 템플릿 코드가 설정되지 않았습니다.';
    case 'template_disabled':
      return '이 알림은 템플릿 스위치가 꺼져 있어 발송되지 않습니다.';
    case 'provider_rejected':
      return '카카오 발송이 공급자 정책에 의해 거부되었습니다.';
    case 'provider_error':
      return 'Bizgo 요청 처리 중 오류가 발생했습니다.';
    default:
      return reason ? `사유: ${reason}` : null;
  }
}

export function buildTestMessage(result: KakaoDeliveryBatchResult) {
  const summary = `성공 ${result.totals.sent}건 · 실패 ${result.totals.failed}건 · 건너뜀 ${result.totals.skipped}건`;
  const detail = result.results[0];

  if (!detail) {
    return summary;
  }

  const parts = [
    `${detail.channel} ${formatDeliveryStatus(detail.status)}`,
    detail.providerCode ? `코드 ${detail.providerCode}` : null,
    detail.providerMessage ? detail.providerMessage : null,
    detail.providerMessageKey ? `msgKey ${detail.providerMessageKey}` : null,
    formatDeliveryReason(detail.reason),
  ].filter(Boolean);

  return `${summary}\n${parts.join(' · ')}`;
}

export function isManagedNotificationType(type: string): type is NotificationEventType {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_VARIABLES, type);
}

export function getVisibleTemplates<T extends { type: NotificationEventType }>(templates: T[]): T[] {
  const eventTypes = Object.keys(NOTIFICATION_VARIABLES) as NotificationEventType[];
  return eventTypes.map((type) => templates.find((template) => template.type === type)).filter(Boolean) as T[];
}
