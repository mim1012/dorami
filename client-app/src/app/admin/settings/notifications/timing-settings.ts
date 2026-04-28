export interface NotificationTimingSetting {
  id: 'order-confirmation-delay' | 'cart-reminder-delay';
  title: string;
  description: string;
  label: string;
  min: number;
  max: number;
  helperText: string;
  zeroBadge?: string;
}

const NOTIFICATION_TIMING_SETTINGS: NotificationTimingSetting[] = [
  {
    id: 'order-confirmation-delay',
    title: '주문 확인 묶음 발송 지연',
    description:
      '라이브 주문만 방송 종료 후 묶어서 보냅니다. 일반 주문 즉시 발송에는 영향 없습니다.',
    label: '방송 종료 후 N시간',
    min: 0,
    max: 168,
    zeroBadge: '종료 직후',
    helperText: '0이면 방송 종료 직후 처리 대상으로 잡힙니다.',
  },
  {
    id: 'cart-reminder-delay',
    title: '장바구니 리마인드 발송 기준',
    description:
      '장바구니에 담은 뒤 이 시간이 지나도 주문하지 않은 고객에게 1회 리마인드를 보냅니다.',
    label: '장기 미구매 장바구니 알림 기준 (시간)',
    min: 1,
    max: 168,
    helperText:
      '타이머 만료 기준이 아니라 장바구니에 담은 뒤 이 시간이 지나도 주문하지 않은 고객에게 1회 알림을 보냅니다.',
  },
];

export function getNotificationTimingSettings(): NotificationTimingSetting[] {
  return NOTIFICATION_TIMING_SETTINGS;
}
