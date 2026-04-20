import type { NotificationEventType } from '@live-commerce/shared-types';

export interface NotificationSourceItem {
  title: string;
  description: string;
}

export interface NotificationSourceGroup {
  heading: string;
  items: NotificationSourceItem[];
}

export interface NotificationPresentation {
  sendTiming: string;
  valueIntro: string;
  primaryAction?: {
    label: string;
    path: string;
  };
  secondaryAction?: {
    label: string;
    path: string;
  };
  sourceGroups: NotificationSourceGroup[];
}

const PRESENTATIONS: Record<NotificationEventType, NotificationPresentation> = {
  LIVE_START: {
    sendTiming: '라이브 방송을 시작하는 순간 고객에게 자동 발송됩니다.',
    valueIntro:
      '여기서는 템플릿 코드만 관리하면 됩니다. 방송마다 제목과 상세내용만 입력하면 됩니다. 나머지는 자동으로 발송됩니다.',
    primaryAction: {
      label: '방송 관리로 이동',
      path: '/admin/broadcasts',
    },
    sourceGroups: [
      {
        heading: '방송 시작할 때 입력하는 항목',
        items: [
          {
            title: '제목',
            description: '방송 시작 화면에서 입력한 제목이 그대로 고객 알림에 들어갑니다.',
          },
          {
            title: '상세내용',
            description: '방송 시작 화면에서 입력한 상세내용이 그대로 고객 알림에 들어갑니다.',
          },
        ],
      },
      {
        heading: '자동으로 붙는 항목',
        items: [
          {
            title: '방송 링크',
            description: '현재 방송 링크가 자동으로 붙습니다.',
          },
          {
            title: '쇼핑몰명',
            description: '도레미마켓 이름이 자동으로 들어갑니다.',
          },
        ],
      },
    ],
  },
  ORDER_CONFIRMATION: {
    sendTiming: '주문이 생성되는 순간 고객에게 알림톡으로 자동 발송됩니다.',
    valueIntro:
      '여기서는 템플릿 코드만 관리하면 됩니다. 주문 정보와 결제 안내는 자동으로 채워지며, 새 템플릿은 #{결제수단} · #{송금계정} · #{수취인명}을 쓰면 됩니다. Zelle/Venmo만 설정하면 그 값만 들어가고 은행명은 끼어들지 않습니다.',
    primaryAction: {
      label: '주문 관리로 이동',
      path: '/admin/orders',
    },
    secondaryAction: {
      label: '결제 설정으로 이동',
      path: '/admin/settings',
    },
    sourceGroups: [
      {
        heading: '주문에서 자동으로 가져오는 항목',
        items: [
          {
            title: '고객명 · 주문번호 · 상품명 · 수량 · 금액',
            description: '주문이 실제로 생성될 때의 데이터가 그대로 들어갑니다.',
          },
        ],
      },
      {
        heading: '관리자 설정에서 가져오는 항목',
        items: [
          {
            title: '입금 안내',
            description:
              'Zelle/Venmo만 설정하면 그 값만 자동으로 사용합니다. 은행 계좌는 선택 사항이라 비워두면 메시지에 들어가지 않습니다.',
          },
        ],
      },
    ],
  },
  PAYMENT_REMINDER: {
    sendTiming: '입금 대기 주문이 있을 때 고객에게 알림톡으로 자동 발송됩니다.',
    valueIntro:
      '여기서는 템플릿 코드만 관리하면 됩니다. 주문 금액과 결제 안내는 자동으로 채워지며, 새 템플릿은 #{결제수단} · #{송금계정} · #{수취인명}을 쓰면 됩니다. Zelle/Venmo만 설정하면 그 값만 들어가고 은행명은 끼어들지 않습니다.',
    primaryAction: {
      label: '주문 관리로 이동',
      path: '/admin/orders',
    },
    secondaryAction: {
      label: '결제 설정으로 이동',
      path: '/admin/settings',
    },
    sourceGroups: [
      {
        heading: '주문에서 자동으로 가져오는 항목',
        items: [
          {
            title: '주문번호 · 금액',
            description: '입금 대기 상태의 주문 데이터에서 자동으로 가져옵니다.',
          },
        ],
      },
      {
        heading: '관리자 설정에서 가져오는 항목',
        items: [
          {
            title: '결제 수단 안내 (#{결제수단} · #{송금계정} · #{수취인명})',
            description:
              'Zelle/Venmo만 설정하면 그 값만 자동으로 사용합니다. 기존 심사본이 있다면 #{은행명} · #{계좌번호} · #{예금주}도 계속 호환됩니다.',
          },
        ],
      },
    ],
  },
  CART_EXPIRING: {
    sendTiming:
      '장바구니에 담아두고도 일정 시간 동안 주문하지 않은 고객에게 친구톡으로 자동 발송됩니다.',
    valueIntro:
      '여기서는 템플릿 코드만 관리하면 됩니다. 고객 정보와 상품 정보는 장바구니 데이터에서 자동으로 채워지며, 발송 시점은 관리자 설정의 장기 미구매 시간 기준을 따릅니다.',
    primaryAction: {
      label: '상품 관리로 이동',
      path: '/admin/products',
    },
    sourceGroups: [
      {
        heading: '장바구니에서 자동으로 가져오는 항목',
        items: [
          {
            title: '고객명 · 상품명 · 수량',
            description: '고객이 장바구니에 담아둔 실제 데이터를 그대로 사용합니다.',
          },
        ],
      },
    ],
  },
};

export function getNotificationPresentation(type: NotificationEventType): NotificationPresentation {
  return PRESENTATIONS[type];
}
