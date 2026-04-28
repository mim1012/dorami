import type { NotificationEventType } from '@live-commerce/shared-types';

interface NotificationEditorAction {
  label: string;
  path: string;
}

export interface NotificationEditorSummary {
  sendTiming: string;
  manageHere: string;
  statusHint: string;
  valueSources: string[];
  actions: NotificationEditorAction[];
}

const DEFAULT_MANAGE_HERE = '여기서는 템플릿 코드 저장과 테스트 발송만 합니다.';
const DEFAULT_STATUS_HINT = '켜고 끄기는 설정 화면에서 바로 관리합니다.';

const EDITOR_SUMMARIES: Record<NotificationEventType, NotificationEditorSummary> = {
  LIVE_START: {
    sendTiming: '라이브 시작 시 자동 발송',
    manageHere: DEFAULT_MANAGE_HERE,
    statusHint: DEFAULT_STATUS_HINT,
    valueSources: [
      '제목/상세내용은 방송 관리에서 입력합니다.',
      '쇼핑몰명과 방송 링크는 자동으로 들어갑니다.',
    ],
    actions: [{ label: '방송 관리', path: '/admin/broadcasts' }],
  },
  ORDER_CONFIRMATION: {
    sendTiming: '주문 직후 또는 라이브 종료 후 묶음 발송',
    manageHere: DEFAULT_MANAGE_HERE,
    statusHint: DEFAULT_STATUS_HINT,
    valueSources: [
      '주문번호/상품/금액은 실제 주문 데이터에서 자동으로 가져옵니다.',
      '결제 안내는 설정에 저장된 Zelle·Venmo·은행 정보에서 가져옵니다.',
    ],
    actions: [
      { label: '주문 관리', path: '/admin/orders' },
      { label: '결제 설정', path: '/admin/settings' },
    ],
  },
  PAYMENT_REMINDER: {
    sendTiming: '입금 대기 주문에 자동 발송',
    manageHere: DEFAULT_MANAGE_HERE,
    statusHint: DEFAULT_STATUS_HINT,
    valueSources: [
      '주문번호/금액은 입금 대기 주문 데이터에서 자동으로 가져옵니다.',
      '결제 안내는 설정에 저장된 Zelle·Venmo·은행 정보에서 가져옵니다.',
    ],
    actions: [
      { label: '주문 관리', path: '/admin/orders' },
      { label: '결제 설정', path: '/admin/settings' },
    ],
  },
  CART_EXPIRING: {
    sendTiming: '장기 미구매 장바구니에 자동 발송',
    manageHere: DEFAULT_MANAGE_HERE,
    statusHint: DEFAULT_STATUS_HINT,
    valueSources: [
      '고객명/상품명/수량은 장바구니 데이터에서 자동으로 가져옵니다.',
      '발송 시점은 설정 화면의 장기 미구매 시간 기준을 따릅니다.',
    ],
    actions: [{ label: '상품/설정 확인', path: '/admin/settings' }],
  },
};

export function getNotificationEditorSummary(
  type: NotificationEventType,
): NotificationEditorSummary {
  return EDITOR_SUMMARIES[type];
}

export function getNotificationStatusText(
  globalEnabled: boolean,
  templateEnabled: boolean,
): string {
  if (!templateEnabled) {
    return '꺼짐';
  }

  return globalEnabled ? '켜짐' : '전체 OFF';
}
