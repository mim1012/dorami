import {
  ADMIN_NOTIFICATION_TEMPLATE_TYPES,
  type AdminNotificationTemplateType,
} from '@live-commerce/shared-types';

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

const PRESENTATIONS: Record<AdminNotificationTemplateType, NotificationPresentation> = {
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
    sendTiming:
      '일반 주문은 주문 생성 직후 발송되고, 라이브 방송 주문은 방송 종료 후 설정한 시간 뒤 같은 고객 + 같은 streamKey 기준으로 묶어서 1회 발송됩니다.',
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
  CART_EXPIRING: {
    sendTiming:
      '방송이 종료된 뒤 설정한 N시간이 지나면, 그 방송 상품을 장바구니에 담아 둔 고객에게 친구톡으로 자동 발송됩니다.',
    valueIntro:
      '여기서는 템플릿 코드만 관리하면 됩니다. 고객별 같은 방송 장바구니 상품을 묶어서 첫 상품명과 추가 상품 건수가 자동으로 채워지며, 지연 시간은 관리자 설정의 방송 종료 후 기준을 따릅니다.',
    primaryAction: {
      label: '상품 관리로 이동',
      path: '/admin/products',
    },
    sourceGroups: [
      {
        heading: '같은 방송 장바구니에서 자동으로 가져오는 항목',
        items: [
          {
            title: '고객명 · 첫 상품명 · 추가 상품 건수',
            description:
              '같은 streamKey에 연결된 활성 장바구니 상품을 묶어 #{상품명} 외 #{수량}건 형태로 사용합니다.',
          },
        ],
      },
    ],
  },
};

function isAdminNotificationTemplateType(type: string): type is AdminNotificationTemplateType {
  return ADMIN_NOTIFICATION_TEMPLATE_TYPES.includes(type as AdminNotificationTemplateType);
}

export function getNotificationPresentation(type: string): NotificationPresentation {
  if (!isAdminNotificationTemplateType(type)) {
    throw new Error(`Unsupported notification presentation type: ${type}`);
  }

  return PRESENTATIONS[type];
}
