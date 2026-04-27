import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AlimtalkService } from './alimtalk.service';

describe('AlimtalkService', () => {
  let service: AlimtalkService;
  let prisma: {
    systemConfig: { findFirst: jest.Mock };
    notificationTemplate: { findFirst: jest.Mock; findMany: jest.Mock };
    order: { findUnique: jest.Mock };
  };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      systemConfig: { findFirst: jest.fn().mockResolvedValue({ alimtalkEnabled: true }) },
      notificationTemplate: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      order: { findUnique: jest.fn() },
    };

    configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'BIZGO_API_KEY') {
          return '';
        }
        if (key === 'BIZGO_SENDER_KEY') {
          return 'sender-key';
        }
        if (key === 'FRONTEND_URL') {
          return 'https://www.doremi-live.com';
        }
        if (key === 'BIZGO_API_URL') {
          return 'https://mars.ibapi.kr/api/comm';
        }
        return fallback;
      }),
    };

    service = new AlimtalkService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  });

  function setBizgoOmniResult(result: unknown) {
    Object.defineProperty(service, 'bizgo', {
      value: {
        send: {
          OMNI: jest.fn().mockResolvedValue(result),
        },
      },
      configurable: true,
    });
  }

  it('returns skipped results when alimtalk is disabled', async () => {
    prisma.systemConfig.findFirst.mockResolvedValue({ alimtalkEnabled: false });

    const result = await service.sendAlimtalk([
      { to: '01012345678', templateCode: 'TPL', text: 'message' },
    ]);

    expect(result.totals).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(result.results[0]).toMatchObject({
      status: 'skipped',
      channel: 'AT',
      recipient: '01012345678',
      reason: 'disabled',
    });
  });

  it('returns sent result when Bizgo accepts alimtalk', async () => {
    setBizgoOmniResult({
      data: {
        data: {
          destinations: [{ code: 'A000', result: 'OK', msgKey: 'msg-1' }],
        },
      },
    });

    const result = await service.sendAlimtalk([
      { to: '01012345678', templateCode: 'TPL', text: 'message' },
    ]);

    expect(result.totals).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(result.results[0]).toMatchObject({
      status: 'sent',
      channel: 'AT',
      recipient: '01012345678',
      providerCode: 'A000',
      providerMessage: 'OK',
      providerMessageKey: 'msg-1',
    });
  });

  it('returns failed result when Bizgo rejects alimtalk', async () => {
    setBizgoOmniResult({
      data: {
        data: {
          destinations: [{ code: 'E400', result: 'INVALID_TEMPLATE' }],
        },
      },
    });

    const result = await service.sendAlimtalk([
      { to: '01012345678', templateCode: 'TPL', text: 'message' },
    ]);

    expect(result.totals).toEqual({ sent: 0, failed: 1, skipped: 0 });
    expect(result.results[0]).toMatchObject({
      status: 'failed',
      channel: 'AT',
      recipient: '01012345678',
      providerCode: 'E400',
      providerMessage: 'INVALID_TEMPLATE',
      reason: 'provider_rejected',
    });
  });

  it('returns skipped result when payment reminder template code is missing', async () => {
    prisma.notificationTemplate.findMany.mockResolvedValue([
      {
        template: '주문 #{주문번호} / #{금액}',
        kakaoTemplateCode: '',
      },
    ]);

    const result = await service.sendPaymentReminderAlimtalk('01012345678', 'ORD-1', 50000);

    expect(result.totals).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(result.results[0]).toMatchObject({
      status: 'skipped',
      channel: 'AT',
      recipient: '01012345678',
      reason: 'template_code_missing',
    });
  });

  it('sends ORDER_CONFIRMATION through alimtalk channel when template code exists', async () => {
    prisma.notificationTemplate.findMany.mockResolvedValue([
      {
        template: '주문 #{주문번호} / #{금액}',
        kakaoTemplateCode: '',
        enabled: true,
      },
      {
        template: '주문 #{주문번호} / #{금액} / #{결제수단}',
        kakaoTemplateCode: 'ORD_TPL',
        enabled: true,
      },
    ]);
    prisma.systemConfig.findFirst.mockResolvedValue({
      alimtalkEnabled: true,
      zelleEmail: 'zelle@example.com',
      zelleRecipientName: 'Zelle Kim',
      venmoEmail: '@venmo',
      venmoRecipientName: 'Venmo Kim',
      bankName: 'KB국민은행',
      bankAccountNumber: '',
      bankAccountHolder: '',
    });
    prisma.order.findUnique.mockResolvedValue({
      user: { name: '테스트 고객' },
      orderItems: [{ productName: '테스트 상품' }],
    });
    setBizgoOmniResult({
      data: { data: { destinations: [{ code: 'A000', result: 'OK', msgKey: 'ord-1' }] } },
    });

    const result = await service.sendOrderAlimtalk('01012345678', 'ORD-1', 50000);

    expect(result.results[0]).toMatchObject({
      status: 'sent',
      channel: 'AT',
      recipient: '01012345678',
      providerMessageKey: 'ord-1',
    });
  });

  it('skips ORDER_CONFIRMATION when alimtalk template code is missing', async () => {
    prisma.notificationTemplate.findMany.mockResolvedValue([
      {
        template: '주문 #{주문번호}',
        kakaoTemplateCode: '',
        enabled: true,
      },
    ]);
    prisma.order.findUnique.mockResolvedValue({
      user: { name: '테스트 고객' },
      orderItems: [{ productName: '테스트 상품' }],
    });

    const result = await service.sendOrderAlimtalk('01012345678', 'ORD-1', 50000);

    expect(result.results[0]).toMatchObject({
      status: 'skipped',
      channel: 'AT',
      recipient: '01012345678',
      reason: 'template_code_missing',
    });
  });

  it('ignores leftover bank name when bank account number is empty', async () => {
    const replaced = (service as any).replacePaymentTemplateVariables(
      '수단 #{결제수단} / 계정 #{송금계정} / 수취인 #{수취인명}',
      (service as any).buildPaymentInfo({
        zelleEmail: 'zelle@example.com',
        zelleRecipientName: 'Zelle Kim',
        venmoEmail: '@venmo',
        venmoRecipientName: 'Venmo Kim',
        bankName: 'KB국민은행',
        bankAccountNumber: '',
        bankAccountHolder: '',
      }),
    );

    expect(replaced).toContain('Zelle / Venmo');
    expect(replaced).not.toContain('KB국민은행');
  });

  it('fills generic payment placeholders with Zelle and Venmo only', async () => {
    const replaced = (service as any).replacePaymentTemplateVariables(
      '수단 #{결제수단} / 계정 #{송금계정} / 수취인 #{수취인명}',
      (service as any).buildPaymentInfo({
        zelleEmail: 'zelle@example.com',
        zelleRecipientName: 'Zelle Kim',
        venmoEmail: '@venmo',
        venmoRecipientName: 'Venmo Kim',
        bankName: '',
        bankAccountNumber: '',
        bankAccountHolder: '',
      }),
    );

    expect(replaced).toContain('Zelle / Venmo');
    expect(replaced).toContain('zelle@example.com / @venmo');
    expect(replaced).toContain('Zelle Kim / Venmo Kim');
    expect(replaced).not.toContain('국민은행');
  });

  it('uses display-name placeholder without extra suffix for single-item order confirmation messages', () => {
    const message = (service as any).buildOrderMessage(
      '01012345678',
      'ORD-1',
      12500,
      {
        user: { name: '김지훈' },
        orderItems: [{ productName: '무료배송이야' }],
      },
      {
        zelleEmail: '422sss@live.com',
        zelleRecipientName: 'MIN KIM',
        venmoEmail: '@doremi03',
        venmoRecipientName: '@doremi03',
      },
      {
        template:
          '[도레미 마켓] 주문이 접수되었습니다\n\n#{고객명}님, 주문이 완료되었습니다.\n\n■ 주문번호: #{주문번호}\n■ 주문상품: #{상품명} 외 #{수량}건\n■ 결제금액: #{금액} $\n\n■ 입금계좌: #{은행명} #{계좌번호} (#{예금주})',
        kakaoTemplateCode: 'CRDER_CONFIRMATION',
      },
    );

    expect(message.text).toContain('■ 주문상품: 무료배송이야');
  });

  it('uses extra item count for multi-item order confirmation messages', () => {
    const message = (service as any).buildOrderMessage(
      '01012345678',
      'ORD-2',
      22500,
      {
        user: { name: '김지훈' },
        orderItems: [{ productName: '상품A' }, { productName: '상품B' }],
      },
      {
        bankName: 'KB국민은행',
        bankAccountNumber: '123-456',
        bankAccountHolder: '홍길동',
      },
      {
        template: '주문상품: #{상품명} 외 #{수량}건',
        kakaoTemplateCode: 'CRDER_CONFIRMATION',
      },
    );

    expect(message.text).toContain('주문상품: 상품A 외 1건');
  });

  it('uses the approved CRDER_CONFIRMATION body without payment account lines', () => {
    const message = (service as any).buildOrderMessage(
      '01012345678',
      'ORD-3',
      12500,
      {
        user: { name: '김지훈' },
        orderItems: [{ productName: '무료배송이야' }],
      },
      {
        zelleEmail: '422sss@live.com',
        zelleRecipientName: 'MIN KIM',
        venmoEmail: '@doremi03',
        venmoRecipientName: '@doremi03',
      },
      {
        template:
          '[도레미 마켓] 주문이 접수되었습니다\n\n#{고객명}님, 주문이 완료되었습니다.\n\n■ 주문번호: #{주문번호}\n■ 주문상품: #{상품명} 외 #{수량}건\n■ 결제금액: #{금액} $\n\n현재 입금대기 상태입니다.\n아래 계좌로 입금해주시면 확인 후 처리됩니다.\n\n■ 입금계좌: #{은행명} #{계좌번호} (#{예금주})',
        kakaoTemplateCode: 'CRDER_CONFIRMATION',
      },
    );

    expect(message.text).toBe(
      '[도레미 마켓] 주문이 접수되었습니다\n\n김지훈님, 주문이 완료되었습니다.\n\n■ 주문번호: ORD-3\n■ 주문상품: 무료배송이야\n■ 결제금액: 12,500 $\n\n현재 입금대기 상태입니다.\n아래 계정으로 입금해주시면 확인 후 처리됩니다.\n\n■ Zelle: 422sss@live.com (MIN KIM)\n■ Venmo: @doremi03 (@doremi03)',
    );
    expect(message.text).not.toContain('입금계좌');
  });

  it('replaces newly approved ORDER_CONFIRMATION placeholders', () => {
    const message = (service as any).buildOrderMessage(
      '01012345678',
      'ORD-4',
      22500,
      {
        user: { name: '김지훈' },
        orderItems: [{ productName: '상품A' }, { productName: '상품B' }],
      },
      {
        zelleEmail: 'zelle@example.com',
        zelleRecipientName: 'Zelle Kim',
        venmoEmail: '@venmo',
        venmoRecipientName: 'Venmo Kim',
      },
      {
        template:
          '[도레미 마켓] 주문이 접수되었습니다\n\n#{고객명}님, 주문이 완료되었습니다.\n\n■ 주문번호: #{주문번호}\n■ 주문상품: #{상품표시명}\n■ 결제금액: #{금액} $\n\n■ Zelle: #{젤계정} (#{젤예금주})\n■ Venmo: #{벤모계정} (#{벤모예금주})',
        kakaoTemplateCode: 'ORDER_CONFIRMATION',
      },
    );

    expect(message.text).toContain('■ 주문상품: 상품A 외 1건');
    expect(message.text).toContain('■ Zelle: zelle@example.com (Zelle Kim)');
    expect(message.text).toContain('■ Venmo: @venmo (Venmo Kim)');
  });

  it('does not attach buttons to grouped ORDER_CONFIRMATION messages when the approved template has no buttons', () => {
    const message = (service as any).buildGroupedOrderMessage(
      {
        phone: '01012345678',
        customerName: '김지훈',
        orderIds: ['ORD-20260425-00001', 'ORD-20260425-00002'],
        totalAmount: 420,
        items: [
          { productName: 'Hermes Stage Load 095', quantity: 1 },
          { productName: 'Hermes Stage Load 096', quantity: 3 },
        ],
      },
      {
        zelleEmail: '422sss@live.com',
        zelleRecipientName: 'MIN KIM',
        venmoEmail: '@doremi03',
        venmoRecipientName: '@doremi03',
      },
      {
        template:
          '[도레미 마켓] 주문이 접수되었습니다\n\n#{고객명}님, 주문이 완료되었습니다.\n\n■ 주문번호: #{주문번호}\n■ 주문상품: #{상품표시명}\n■ 결제금액: #{금액} $',
        kakaoTemplateCode: 'ORDER_CONFIRMATION',
      },
    );

    expect(message.buttons).toBeUndefined();
  });

  it('uses grouped order quantities when rendering ORDER_CONFIRMATION product summary', () => {
    const message = (service as any).buildGroupedOrderMessage(
      {
        phone: '01075358897',
        customerName: '김지훈',
        orderIds: ['ORD-20260426-00002', 'ORD-20260426-00003'],
        totalAmount: 3165,
        items: [
          { productName: 'Hermes Stage Load 097', quantity: 2 },
          { productName: 'Hermes Stage Load 098', quantity: 1 },
        ],
      },
      {
        zelleEmail: '422sss@live.com',
        zelleRecipientName: 'MIN KIM',
        venmoEmail: '@doremi03',
        venmoRecipientName: '@doremi03',
      },
      {
        template:
          '[도레미 마켓] 주문이 접수되었습니다\n\n#{고객명}님, 주문이 완료되었습니다.\n\n■ 주문번호: #{주문번호}\n■ 주문상품: #{상품표시명}\n■ 결제금액: #{금액} $\n\n현재 입금대기 상태입니다.\n아래 계정으로 입금해주시면 확인 후 처리됩니다.\n\n■ Zelle: #{젤계정} (#{젤예금주})\n■ Venmo: #{벤모계정} (#{벤모예금주})',
        kakaoTemplateCode: 'ORDER_CONFIRMATION',
      },
    );

    expect(message.text).toContain('■ 주문번호: ORD-20260426-00002 외 1건');
    expect(message.text).toContain('■ 주문상품: Hermes Stage Load 097 외 2건');
  });

  it('uses system config payment info for ORDER_CONFIRMATION test sends', async () => {
    prisma.notificationTemplate.findMany.mockResolvedValue([
      {
        template:
          '[도레미 마켓] 주문이 접수되었습니다\n\n#{고객명}님, 주문이 완료되었습니다.\n\n■ 주문번호: #{주문번호}\n■ 주문상품: #{상품표시명}\n■ 결제금액: #{금액} $\n\n■ Zelle: #{젤계정} (#{젤예금주})\n■ Venmo: #{벤모계정} (#{벤모예금주})',
        kakaoTemplateCode: 'ORDER_CONFIRMATION',
        enabled: true,
      },
    ]);
    prisma.systemConfig.findFirst.mockResolvedValue({
      alimtalkEnabled: true,
      zelleEmail: '422sss@live.com',
      zelleRecipientName: 'MIN KIM',
      venmoEmail: '@doremi03',
      venmoRecipientName: '@doremi03',
      bankName: 'KB국민은행',
      bankAccountNumber: '',
      bankAccountHolder: '',
    });
    setBizgoOmniResult({
      data: { data: { destinations: [{ code: 'A000', result: 'OK', msgKey: 'order-test-1' }] } },
    });

    const result = await service.sendTestOrderAlimtalk('01012345678');

    expect(result.results[0]).toMatchObject({
      status: 'sent',
      channel: 'AT',
      recipient: '01012345678',
      providerMessageKey: 'order-test-1',
    });
    const omniMock = (service as any).bizgo.send.OMNI as jest.Mock;
    const request = omniMock.mock.calls[0][0];
    const text = request.messageFlow[0].alimtalk.text;
    expect(text).toContain('■ Zelle: 422sss@live.com (MIN KIM)');
    expect(text).toContain('■ Venmo: @doremi03 (@doremi03)');
  });

  it('uses friendtalk path for cart reminder test sends', async () => {
    prisma.notificationTemplate.findMany.mockResolvedValue([
      {
        template: '[도레미마켓] 장바구니 리마인드',
        kakaoTemplateCode: '',
        enabled: true,
      },
    ]);
    setBizgoOmniResult({
      data: { data: { destinations: [{ code: 'A000', result: 'OK', msgKey: 'cart-ft-1' }] } },
    });

    const result = await service.sendTestCartExpiring('01012345678');

    expect(result.results[0]).toMatchObject({
      status: 'sent',
      channel: 'FT',
      recipient: '01012345678',
      providerMessageKey: 'cart-ft-1',
    });

    const omniMock = (service as any).bizgo.send.OMNI as jest.Mock;
    const request = omniMock.mock.calls[0][0];
    const text = request.messageFlow[0].brandmessage.text;
    expect(text).toContain('테스트 상품');
  });

  it('renders cart reminder friendtalk with the required 상품명 외 수량건 pattern', async () => {
    prisma.notificationTemplate.findMany.mockResolvedValue([
      {
        template: '[도레미마켓] 장바구니 리마인드',
        kakaoTemplateCode: '',
        enabled: true,
      },
    ]);
    setBizgoOmniResult({
      data: { data: { destinations: [{ code: 'A000', result: 'OK', msgKey: 'cart-ft-2' }] } },
    });

    await service.sendCartReminderFriendtalk('01012345678', '첫 상품', 2, 'stream-1');

    const omniMock = (service as any).bizgo.send.OMNI as jest.Mock;
    const request = omniMock.mock.calls[0][0];
    const text = request.messageFlow[0].brandmessage.text;
    expect(text).toContain('"첫 상품 외 2건"');
  });

  it('keeps legacy bank placeholders working for old approved templates', async () => {
    const replaced = (service as any).replacePaymentTemplateVariables(
      '수단 #{은행명} / 계정 #{계좌번호} / 수취인 #{예금주}',
      (service as any).buildPaymentInfo({
        zelleEmail: 'zelle@example.com',
        zelleRecipientName: 'Zelle Kim',
        venmoEmail: '@venmo',
        venmoRecipientName: 'Venmo Kim',
        bankName: '',
        bankAccountNumber: '',
        bankAccountHolder: '',
      }),
    );

    expect(replaced).toContain('Zelle / Venmo');
    expect(replaced).toContain('zelle@example.com / @venmo');
    expect(replaced).toContain('Zelle Kim / Venmo Kim');
    expect(replaced).not.toContain('국민은행');
  });

  it('normalizes raw 10-digit US kakao_phone values to +1 E.164 before sending', () => {
    expect((service as any).normalizeKakaoPhone('9177534870')).toBe('+19177534870');
    expect((service as any).normalizeKakaoPhone(' 2146817720 ')).toBe('+12146817720');
  });

  it('preserves already normalized +1 kakao_phone values and blanks', () => {
    expect((service as any).normalizeKakaoPhone('+18581236583')).toBe('+18581236583');
    expect((service as any).normalizeKakaoPhone('')).toBe('');
    expect((service as any).normalizeKakaoPhone(undefined)).toBe('');
  });
});
