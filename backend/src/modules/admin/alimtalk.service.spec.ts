import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AlimtalkService } from './alimtalk.service';

describe('AlimtalkService', () => {
  let service: AlimtalkService;
  let prisma: {
    systemConfig: { findFirst: jest.Mock };
    notificationTemplate: { findFirst: jest.Mock };
    order: { findUnique: jest.Mock };
  };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      systemConfig: { findFirst: jest.fn().mockResolvedValue({ alimtalkEnabled: true }) },
      notificationTemplate: { findFirst: jest.fn() },
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
    prisma.notificationTemplate.findFirst.mockResolvedValue({
      template: '주문 #{주문번호} / #{금액}',
      kakaoTemplateCode: '',
    });

    const result = await service.sendPaymentReminderAlimtalk('01012345678', 'ORD-1', 50000);

    expect(result.totals).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(result.results[0]).toMatchObject({
      status: 'skipped',
      channel: 'AT',
      recipient: '01012345678',
      reason: 'template_code_missing',
    });
  });
});
