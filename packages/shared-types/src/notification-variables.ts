export type NotificationTemplateType =
  | 'ORDER_CONFIRMATION'
  | 'PAYMENT_REMINDER'
  | 'CART_EXPIRING'
  | 'LIVE_START';

export type NotificationChannelType = 'AT' | 'FT';
export type NotificationVariableSourceType = 'event' | 'system' | 'computed';

export interface NotificationVariableDefinition {
  key: string;
  label: string;
  description: string;
  sourceType: NotificationVariableSourceType;
  sourcePath: string;
  required: boolean;
  sample: string;
}

export interface NotificationTemplateVariableDefinition {
  type: NotificationTemplateType;
  label: string;
  channel: NotificationChannelType;
  variables: NotificationVariableDefinition[];
}

export const NOTIFICATION_TEMPLATE_VARIABLES: Record<
  NotificationTemplateType,
  NotificationTemplateVariableDefinition
> = {
  ORDER_CONFIRMATION: {
    type: 'ORDER_CONFIRMATION',
    label: '주문 확인',
    channel: 'FT',
    variables: [
      {
        key: '#{고객명}',
        label: '고객명',
        description: '주문한 고객 이름',
        sourceType: 'event',
        sourcePath: 'order.user.name',
        required: true,
        sample: '홍길동',
      },
      {
        key: '#{주문번호}',
        label: '주문번호',
        description: '생성된 주문 번호',
        sourceType: 'event',
        sourcePath: 'order.id',
        required: true,
        sample: 'ORD-20260417-00001',
      },
      {
        key: '#{상품명}',
        label: '상품명',
        description: '주문 대표 상품명',
        sourceType: 'event',
        sourcePath: 'order.orderItems[0].productName',
        required: true,
        sample: '플라워 원피스',
      },
      {
        key: '#{수량}',
        label: '수량',
        description: '주문 상품 개수',
        sourceType: 'computed',
        sourcePath: 'computed.order.itemCount',
        required: true,
        sample: '2',
      },
      {
        key: '#{금액}',
        label: '금액',
        description: '주문 총 결제 금액',
        sourceType: 'event',
        sourcePath: 'order.total',
        required: true,
        sample: '58,000',
      },
      {
        key: '#{결제수단명}',
        label: '결제수단명',
        description: '우선 적용된 결제 수단 이름',
        sourceType: 'computed',
        sourcePath: 'computed.payment.label',
        required: false,
        sample: 'Zelle',
      },
      {
        key: '#{결제계정}',
        label: '결제계정',
        description: '결제 수단에 대응하는 계정 또는 계좌번호',
        sourceType: 'computed',
        sourcePath: 'computed.payment.account',
        required: false,
        sample: 'doremi@example.com',
      },
      {
        key: '#{수취인명}',
        label: '수취인명',
        description: '결제 수단에 대응하는 수취인 이름',
        sourceType: 'computed',
        sourcePath: 'computed.payment.recipient',
        required: false,
        sample: 'Doremi Shop',
      },
      {
        key: '#{은행명}',
        label: '은행명',
        description: '기존 템플릿 호환용 결제수단명',
        sourceType: 'computed',
        sourcePath: 'computed.payment.legacy.bankName',
        required: false,
        sample: 'Zelle',
      },
      {
        key: '#{계좌번호}',
        label: '계좌번호',
        description: '기존 템플릿 호환용 결제계정',
        sourceType: 'computed',
        sourcePath: 'computed.payment.legacy.account',
        required: false,
        sample: 'doremi@example.com',
      },
      {
        key: '#{예금주}',
        label: '예금주',
        description: '기존 템플릿 호환용 수취인명',
        sourceType: 'computed',
        sourcePath: 'computed.payment.legacy.recipient',
        required: false,
        sample: 'Doremi Shop',
      },
    ],
  },
  PAYMENT_REMINDER: {
    type: 'PAYMENT_REMINDER',
    label: '입금 안내',
    channel: 'AT',
    variables: [
      {
        key: '#{고객명}',
        label: '고객명',
        description: '주문 고객 이름',
        sourceType: 'event',
        sourcePath: 'order.user.name',
        required: false,
        sample: '홍길동',
      },
      {
        key: '#{주문번호}',
        label: '주문번호',
        description: '입금 대상 주문 번호',
        sourceType: 'event',
        sourcePath: 'order.id',
        required: true,
        sample: 'ORD-20260417-00001',
      },
      {
        key: '#{금액}',
        label: '금액',
        description: '입금해야 할 금액',
        sourceType: 'event',
        sourcePath: 'order.total',
        required: true,
        sample: '58,000',
      },
      {
        key: '#{결제수단명}',
        label: '결제수단명',
        description: '우선 적용된 결제 수단 이름',
        sourceType: 'computed',
        sourcePath: 'computed.payment.label',
        required: false,
        sample: 'Zelle',
      },
      {
        key: '#{결제계정}',
        label: '결제계정',
        description: '결제 수단에 대응하는 계정 또는 계좌번호',
        sourceType: 'computed',
        sourcePath: 'computed.payment.account',
        required: false,
        sample: 'doremi@example.com',
      },
      {
        key: '#{수취인명}',
        label: '수취인명',
        description: '결제 수단에 대응하는 수취인 이름',
        sourceType: 'computed',
        sourcePath: 'computed.payment.recipient',
        required: false,
        sample: 'Doremi Shop',
      },
      {
        key: '#{주문상세URL}',
        label: '주문상세URL',
        description: '주문 상세 페이지 URL',
        sourceType: 'computed',
        sourcePath: 'computed.order.detailUrl',
        required: false,
        sample: 'https://www.doremi-live.com/orders/ORD-20260417-00001',
      },
      {
        key: '#{은행명}',
        label: '은행명',
        description: '기존 템플릿 호환용 결제수단명',
        sourceType: 'computed',
        sourcePath: 'computed.payment.legacy.bankName',
        required: false,
        sample: 'Zelle',
      },
      {
        key: '#{계좌번호}',
        label: '계좌번호',
        description: '기존 템플릿 호환용 결제계정',
        sourceType: 'computed',
        sourcePath: 'computed.payment.legacy.account',
        required: false,
        sample: 'doremi@example.com',
      },
      {
        key: '#{예금주}',
        label: '예금주',
        description: '기존 템플릿 호환용 수취인명',
        sourceType: 'computed',
        sourcePath: 'computed.payment.legacy.recipient',
        required: false,
        sample: 'Doremi Shop',
      },
    ],
  },
  CART_EXPIRING: {
    type: 'CART_EXPIRING',
    label: '장바구니 만료 예정',
    channel: 'AT',
    variables: [
      {
        key: '#{고객명}',
        label: '고객명',
        description: '수신 고객 이름',
        sourceType: 'event',
        sourcePath: 'customer.name',
        required: true,
        sample: '홍길동',
      },
      {
        key: '#{상품명}',
        label: '상품명',
        description: '장바구니 대표 상품명',
        sourceType: 'event',
        sourcePath: 'cart.productName',
        required: true,
        sample: '플라워 원피스',
      },
      {
        key: '#{수량}',
        label: '수량',
        description: '장바구니 상품 수량',
        sourceType: 'event',
        sourcePath: 'cart.itemCount',
        required: true,
        sample: '1',
      },
    ],
  },
  LIVE_START: {
    type: 'LIVE_START',
    label: '라이브 시작',
    channel: 'AT',
    variables: [
      {
        key: '#{쇼핑몰명}',
        label: '쇼핑몰명',
        description: '라이브 시작 알림에 고정으로 들어가는 마켓 이름',
        sourceType: 'computed',
        sourcePath: 'computed.live.marketName',
        required: true,
        sample: 'Doremi Market',
      },
      {
        key: '#{라이브주제}',
        label: '라이브주제',
        description: '라이브 방송 제목',
        sourceType: 'event',
        sourcePath: 'live.title',
        required: true,
        sample: '금요일 봄 신상 라이브',
      },
      {
        key: '#{상세내용}',
        label: '상세내용',
        description: '라이브 상세 설명. 없으면 제목으로 대체',
        sourceType: 'computed',
        sourcePath: 'computed.live.description',
        required: true,
        sample: '오늘 저녁 8시 봄 신상과 재입고 상품을 소개합니다.',
      },
      {
        key: '#{방송URL}',
        label: '방송URL',
        description: '라이브 방송 바로가기 URL',
        sourceType: 'event',
        sourcePath: 'live.url',
        required: true,
        sample: 'https://www.doremi-live.com/live/spring-sale',
      },
    ],
  },
} as const;

export const NOTIFICATION_TEMPLATE_TYPES = Object.keys(
  NOTIFICATION_TEMPLATE_VARIABLES,
) as NotificationTemplateType[];

export function getNotificationTemplateVariableDefinition(
  type: NotificationTemplateType,
): NotificationTemplateVariableDefinition {
  return NOTIFICATION_TEMPLATE_VARIABLES[type];
}
