import { ConfigService } from '@nestjs/config';
import { AlimtalkService } from './alimtalk.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AlimtalkService', () => {
  let service: AlimtalkService;
  let prisma: {
    systemConfig: { findFirst: jest.Mock };
    notificationTemplate: { findFirst: jest.Mock };
    order: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'system', alimtalkEnabled: true }),
      },
      notificationTemplate: {
        findFirst: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
    };

    const configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          FRONTEND_URL: 'https://frontend.example.com',
          BIZGO_API_KEY: '',
          BIZGO_SENDER_KEY: 'sender-key',
          BIZGO_API_URL: 'https://mars.ibapi.kr/api/comm',
        };

        return config[key] ?? defaultValue;
      }),
    } as unknown as ConfigService;

    service = new AlimtalkService(prisma as unknown as PrismaService, configService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildOrderMessage', () => {
    it('renders metadata-backed payment variables including legacy aliases', () => {
      const message = (service as any).buildOrderMessage(
        '01012345678',
        'ORD-20260417-00001',
        58000,
        {
          user: { name: '홍길동' },
          orderItems: [{ productName: '플라워 원피스' }, { productName: '리본 블라우스' }],
        },
        {
          zelleEmail: 'pay@doremi.com',
          zelleRecipientName: '도레미샵',
          bankName: 'KB국민은행',
          bankAccountNumber: '111-222-333',
          bankAccountHolder: '도레미뱅크',
        },
        {
          template:
            '주문 #{주문번호} / #{고객명} / #{상품명} / #{수량} / #{금액} / #{결제수단명} / #{결제계정} / #{수취인명} / #{은행명} / #{계좌번호} / #{예금주}',
          kakaoTemplateCode: 'ORDER_TMPL',
        },
      );

      expect(message.text).toBe(
        '주문 ORD-20260417-00001 / 홍길동 / 플라워 원피스 / 2 / 58,000 / Zelle / pay@doremi.com / 도레미샵 / Zelle / pay@doremi.com / 도레미샵',
      );
      expect(message.buttons).toEqual([
        {
          buttonType: 'WL',
          buttonName: '주문 상세 보기',
          linkMo: 'https://frontend.example.com/orders/ORD-20260417-00001',
        },
      ]);
    });
  });

  describe('sendPaymentReminderAlimtalk', () => {
    it('renders richer payment reminder variables and keeps legacy aliases working', async () => {
      prisma.notificationTemplate.findFirst.mockResolvedValue({
        template:
          '#{고객명}님 주문 #{주문번호} #{금액}원 / #{결제수단명} / #{결제계정} / #{수취인명} / #{은행명} / #{계좌번호} / #{예금주} / #{주문상세URL}',
        kakaoTemplateCode: 'PAYMENT_TMPL',
      });
      prisma.order.findUnique.mockResolvedValue({
        user: { name: '홍길동' },
      });
      prisma.systemConfig.findFirst
        .mockResolvedValueOnce({ id: 'system', alimtalkEnabled: true })
        .mockResolvedValueOnce({
          id: 'system',
          zelleEmail: 'pay@doremi.com',
          zelleRecipientName: '도레미샵',
          bankName: 'KB국민은행',
          bankAccountNumber: '111-222-333',
          bankAccountHolder: '도레미뱅크',
        });

      const sendSpy = jest.spyOn(service as any, '_sendAlimtalk').mockResolvedValue(undefined);

      await service.sendPaymentReminderAlimtalk('01099998888', 'ORD-20260417-00001', 58000);

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'ORD-20260417-00001' },
        include: {
          user: { select: { name: true } },
        },
      });
      expect(sendSpy).toHaveBeenCalledWith([
        {
          to: '01099998888',
          templateCode: 'PAYMENT_TMPL',
          text:
            '홍길동님 주문 ORD-20260417-00001 58,000원 / Zelle / pay@doremi.com / 도레미샵 / Zelle / pay@doremi.com / 도레미샵 / https://frontend.example.com/orders/ORD-20260417-00001',
          buttons: [
            {
              buttonType: 'WL',
              buttonName: '주문 확인하기',
              linkMo: 'https://frontend.example.com/orders/ORD-20260417-00001',
            },
          ],
        },
      ]);
    });
  });

  describe('sendLiveStartAlimtalk', () => {
    it('uses the hardcoded Doremi Market name and falls back description to title', async () => {
      prisma.notificationTemplate.findFirst.mockResolvedValue({
        template: '#{쇼핑몰명} / #{라이브주제} / #{상세내용} / #{방송URL}',
        kakaoTemplateCode: 'LIVE_TMPL',
      });

      const sendSpy = jest.spyOn(service, 'sendAlimtalk').mockResolvedValue(undefined);

      await service.sendLiveStartAlimtalk(
        ['01011112222', '01033334444'],
        '금요일 봄 신상 라이브',
        'https://frontend.example.com/live/spring-sale',
      );

      expect(sendSpy).toHaveBeenCalledWith([
        {
          to: '01011112222',
          templateCode: 'LIVE_TMPL',
          text:
            'Doremi Market / 금요일 봄 신상 라이브 / 금요일 봄 신상 라이브 / https://frontend.example.com/live/spring-sale',
          buttons: [
            {
              buttonType: 'WL',
              buttonName: '라이브 보러가기',
              linkMo: 'https://frontend.example.com/live/spring-sale',
              linkPc: 'https://frontend.example.com/live/spring-sale',
            },
          ],
        },
        {
          to: '01033334444',
          templateCode: 'LIVE_TMPL',
          text:
            'Doremi Market / 금요일 봄 신상 라이브 / 금요일 봄 신상 라이브 / https://frontend.example.com/live/spring-sale',
          buttons: [
            {
              buttonType: 'WL',
              buttonName: '라이브 보러가기',
              linkMo: 'https://frontend.example.com/live/spring-sale',
              linkPc: 'https://frontend.example.com/live/spring-sale',
            },
          ],
        },
      ]);
    });
  });
});
