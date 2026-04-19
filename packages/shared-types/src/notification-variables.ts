/**
 * 알림톡/친구톡 템플릿 변수 중앙 상수.
 *
 * 이 파일은 backend/src/modules/admin/alimtalk.service.ts 의 실제 .replace()
 * 호출과 1:1로 일치해야 한다. drift 가 발생하면 관리자가 admin UI 에서
 * 변수를 참고해 템플릿을 심사받아도 치환이 안 되거나 잘못된 값이 들어간다.
 *
 * 변수를 추가/제거할 때는 backend 서비스 파일도 같이 수정할 것.
 */
export const NOTIFICATION_VARIABLES = {
  ORDER_CONFIRMATION: {
    label: '주문 확인 (친구톡)',
    channel: 'FT' as const,
    variables: [
      '#{고객명}',
      '#{주문번호}',
      '#{상품명}',
      '#{수량}',
      '#{금액}',
      '#{결제수단}',
      '#{송금계정}',
      '#{수취인명}',
    ],
    legacyVariables: ['#{은행명}', '#{계좌번호}', '#{예금주}'],
  },
  PAYMENT_REMINDER: {
    label: '입금 안내 (알림톡)',
    channel: 'AT' as const,
    variables: ['#{주문번호}', '#{금액}', '#{결제수단}', '#{송금계정}', '#{수취인명}'],
    legacyVariables: ['#{은행명}', '#{계좌번호}', '#{예금주}'],
  },
  CART_EXPIRING: {
    label: '장바구니 만료 (알림톡)',
    channel: 'AT' as const,
    variables: ['#{고객명}', '#{상품명}', '#{수량}'],
  },
  LIVE_START: {
    label: '라이브 시작 (알림톡)',
    channel: 'AT' as const,
    variables: ['#{쇼핑몰명}', '#{라이브주제}', '#{상세내용}', '#{방송URL}'],
  },
} as const;

export type NotificationEventType = keyof typeof NOTIFICATION_VARIABLES;
export type NotificationChannel = 'AT' | 'FT';
