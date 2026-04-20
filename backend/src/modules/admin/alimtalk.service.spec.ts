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
});
