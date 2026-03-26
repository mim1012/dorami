import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OMNI,
  OMNIOptionsBuilder,
  AlimtalkRequestBodyBuilder,
  KakaoButtonBuilder,
} from '@infobank/infobank-omni-sdk-js';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AlimtalkMessage {
  to: string; // phone number e.g. "01012345678"
  templateCode: string;
  text: string; // full message body (must match registered template)
  variables?: Record<string, string>;
  buttons?: Array<{
    buttonType: 'WL';
    buttonName: string;
    linkMo: string;
    linkPc?: string;
  }>;
}

@Injectable()
export class AlimtalkService implements OnModuleInit {
  private readonly logger = new Logger(AlimtalkService.name);
  private omni: OMNI | null = null;
  private readonly senderKey: string;
  private readonly baseUrl: string;
  private readonly apiId: string;
  private readonly apiPassword: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.senderKey = this.configService.get<string>('BIZGO_PF_ID', '');
    this.apiId = this.configService.get<string>('BIZGO_API_ID', '');
    this.apiPassword = this.configService.get<string>('BIZGO_API_PASSWORD', '');

    const isSandbox = this.configService.get<string>('BIZGO_SANDBOX', 'false') === 'true';
    this.baseUrl = this.configService.get<string>(
      'BIZGO_API_URL',
      isSandbox ? 'https://sandbox-api.omni.co.kr' : 'https://api.omni.co.kr',
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.apiId || !this.apiPassword) {
      this.logger.warn(
        'Bizgo OMNI SDK credentials not configured (BIZGO_API_ID or BIZGO_API_PASSWORD missing)',
      );
      return;
    }

    try {
      await this.initializeOmni();
      this.logger.log('Bizgo OMNI SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Bizgo OMNI SDK', error);
    }
  }

  private async initializeOmni(): Promise<void> {
    const authClient = new OMNI(
      new OMNIOptionsBuilder()
        .setBaseURL(this.baseUrl)
        .setId(this.apiId)
        .setPassword(this.apiPassword)
        .build(),
    );

    const tokenResponse = await authClient.auth!.getToken();

    this.omni = new OMNI(
      new OMNIOptionsBuilder().setBaseURL(this.baseUrl).setToken(tokenResponse.data.token).build(),
    );

    this.logger.debug(`Bizgo token acquired, expires: ${tokenResponse.data.expired}`);
  }

  private async ensureOmniClient(): Promise<OMNI | null> {
    if (!this.omni) {
      try {
        await this.initializeOmni();
      } catch (error) {
        this.logger.error('Failed to re-initialize Bizgo OMNI SDK', error);
        return null;
      }
    }
    return this.omni;
  }

  async sendAlimtalk(messages: AlimtalkMessage[]): Promise<void> {
    const config = await this.prisma.systemConfig.findFirst({ where: { id: 'system' } });

    if (!config?.alimtalkEnabled) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return;
    }

    const client = await this.ensureOmniClient();
    if (!client?.send) {
      this.logger.warn('Bizgo OMNI SDK not available, skipping send');
      return;
    }

    for (const msg of messages) {
      try {
        const buttons = msg.buttons?.map((btn) =>
          new KakaoButtonBuilder()
            .setType(btn.buttonType)
            .setName(btn.buttonName)
            .setUrlMobile(btn.linkMo)
            .setUrlPc(btn.linkPc ?? btn.linkMo)
            .build(),
        );

        const body = new AlimtalkRequestBodyBuilder()
          .setSenderKey(this.senderKey)
          .setMsgType('AT')
          .setTo(msg.to)
          .setTemplateCode(msg.templateCode)
          .setText(msg.text)
          .setButton(buttons ?? [])
          .build();

        const response = await client.send.Alimtalk(body);

        if (response.code === '1000') {
          this.logger.log(`Alimtalk sent to ${msg.to}`, { msgKey: response.msgKey });
        } else {
          this.logger.warn(`Alimtalk send returned code ${response.code}: ${response.result}`, {
            to: msg.to,
          });
        }
      } catch (error: unknown) {
        const axiosError = error as { response?: { status: number; data: unknown } };
        if (axiosError.response) {
          this.logger.error(
            `Alimtalk API error (${axiosError.response.status})`,
            axiosError.response.data,
          );

          if (axiosError.response.status === 401) {
            this.omni = null;
          }
        } else {
          this.logger.error('Failed to send alimtalk', error);
        }
      }
    }
  }

  async sendOrderAlimtalk(phone: string, orderId: string, total: number): Promise<void> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'ORDER_CONFIRMATION' },
    });

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('ORDER_CONFIRMATION alimtalk template code not configured, skipping');
      return;
    }

    const text = template.template
      .replace('#{주문번호}', orderId)
      .replace('#{금액}', total.toLocaleString());

    await this.sendAlimtalk([
      {
        to: phone,
        templateCode: template.kakaoTemplateCode,
        text,
        buttons: [
          {
            buttonType: 'WL',
            buttonName: '주문 상세 보기',
            linkMo: `https://www.doremi-live.com/orders/${orderId}`,
          },
        ],
      },
    ]);
  }

  async sendPaymentReminderAlimtalk(phone: string, orderId: string, total: number): Promise<void> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'PAYMENT_REMINDER' },
    });

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('PAYMENT_REMINDER alimtalk template code not configured, skipping');
      return;
    }

    const text = template.template
      .replace('#{주문번호}', orderId)
      .replace('#{금액}', total.toLocaleString());

    await this.sendAlimtalk([
      {
        to: phone,
        templateCode: template.kakaoTemplateCode,
        text,
        buttons: [
          {
            buttonType: 'WL',
            buttonName: '주문 확인하기',
            linkMo: `https://www.doremi-live.com/orders/${orderId}`,
          },
        ],
      },
    ]);
  }

  async sendCartExpiringAlimtalk(
    phone: string,
    customerName: string,
    productName: string,
    itemCount: number,
  ): Promise<void> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'CART_EXPIRING' },
    });

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('CART_EXPIRING alimtalk template code not configured, skipping');
      return;
    }

    const text = template.template
      .replace('#{고객명}', customerName)
      .replace('#{상품명}', productName)
      .replace('#{수량}', String(itemCount));

    await this.sendAlimtalk([
      {
        to: phone,
        templateCode: template.kakaoTemplateCode,
        text,
        buttons: [
          {
            buttonType: 'WL',
            buttonName: '장바구니 확인',
            linkMo: 'https://www.doremi-live.com/cart',
            linkPc: 'https://www.doremi-live.com/cart',
          },
        ],
      },
    ]);
  }

  async sendLiveStartAlimtalk(
    phoneNumbers: string[],
    streamTitle: string,
    streamUrl: string,
  ): Promise<void> {
    if (phoneNumbers.length === 0) {
      return;
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'LIVE_START' },
    });

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('LIVE_START alimtalk template code not configured');
      return;
    }

    const messages: AlimtalkMessage[] = phoneNumbers.map((phone) => ({
      to: phone,
      templateCode: template.kakaoTemplateCode,
      text: template.template.replace('#{streamTitle}', streamTitle),
      buttons: [
        {
          buttonType: 'WL',
          buttonName: '라이브 보러가기',
          linkMo: streamUrl,
          linkPc: streamUrl,
        },
      ],
    }));

    await this.sendAlimtalk(messages);
  }
}
