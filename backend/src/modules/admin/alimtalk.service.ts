import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Bizgo,
  BizgoOptionsBuilder,
  AlimtalkBuilder,
  AlimtalkAttachmentBuilder,
  BrandMessageBuilder,
  BrandMessageAttachmentBuilder,
  DestinationBuilder,
  OMNIRequestBodyBuilder,
  KakaoButtonBuilder,
} from '@bizgo/bizgo-sdk-comm-js';
import {
  getNotificationTemplateVariableDefinition,
  type NotificationTemplateType,
} from '@live-commerce/shared-types';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AlimtalkMessage {
  to: string; // phone number e.g. "01012345678"
  templateCode: string;
  text: string; // full message body (must match registered template)
  buttons?: Array<{
    buttonType: 'WL';
    buttonName: string;
    linkMo: string;
    linkPc?: string;
  }>;
}

interface OrderAlimtalkData {
  id: string;
  total: unknown;
  user: { kakaoPhone: string | null; name: string | null } | null;
  orderItems: Array<{ productName: string }>;
}

interface PaymentConfig {
  zelleEmail?: string | null;
  zelleRecipientName?: string | null;
  venmoEmail?: string | null;
  venmoRecipientName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
}

interface OrderTemplate {
  template: string;
  kakaoTemplateCode: string;
}

const SEND_CONCURRENCY = 10;
const LIVE_START_MARKET_NAME = 'Doremi Market';

type TemplateVariables = Record<string, string>;

interface PaymentDetails {
  label: string;
  account: string;
  recipient: string;
}

function renderTemplate(template: string, variables: TemplateVariables): string {
  return Object.entries(variables).reduce(
    (rendered, [key, value]) => rendered.replaceAll(key, value ?? ''),
    template,
  );
}

function resolvePreferredPaymentDetails(config: PaymentConfig | null): PaymentDetails {
  if (config?.zelleEmail) {
    return {
      label: 'Zelle',
      account: config.zelleEmail,
      recipient: config.zelleRecipientName ?? '',
    };
  }

  if (config?.venmoEmail) {
    return {
      label: 'Venmo',
      account: config.venmoEmail,
      recipient: config.venmoRecipientName ?? '',
    };
  }

  return {
    label: config?.bankName ?? '',
    account: config?.bankAccountNumber ?? '',
    recipient: config?.bankAccountHolder ?? '',
  };
}

@Injectable()
export class AlimtalkService {
  private readonly logger = new Logger(AlimtalkService.name);
  private readonly bizgo: Bizgo | null = null;
  private readonly senderKey: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.senderKey = this.configService.get<string>('BIZGO_SENDER_KEY', '');
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'https://www.doremi-live.com',
    );
    const apiKey = this.configService.get<string>('BIZGO_API_KEY', '');
    const baseUrl = this.configService.get<string>(
      'BIZGO_API_URL',
      'https://mars.ibapi.kr/api/comm',
    );

    if (!apiKey) {
      this.logger.warn('BIZGO_API_KEY not configured — alimtalk/friendtalk disabled');
      return;
    }

    this.bizgo = new Bizgo(new BizgoOptionsBuilder().setBaseURL(baseUrl).setApiKey(apiKey).build());

    this.logger.log('Bizgo SDK initialized');
  }

  private async isEnabled(): Promise<boolean> {
    const config = await this.prisma.systemConfig.findFirst({ where: { id: 'system' } });
    return !!config?.alimtalkEnabled;
  }

  private logSendError(context: string, error: unknown): void {
    const axiosError = error as { response?: { status: number; data: unknown } };
    if (axiosError.response) {
      this.logger.error(
        `${context} API error (${axiosError.response.status})`,
        axiosError.response.data,
      );
    } else {
      this.logger.error(`Failed to ${context}`, error);
    }
  }

  private getTemplateKeys(type: NotificationTemplateType): string[] {
    return getNotificationTemplateVariableDefinition(type).variables.map((variable) => variable.key);
  }

  private buildTemplateVariables(
    type: NotificationTemplateType,
    values: Partial<TemplateVariables>,
  ): TemplateVariables {
    return this.getTemplateKeys(type).reduce<TemplateVariables>((acc, key) => {
      acc[key] = values[key] ?? '';
      return acc;
    }, {});
  }

  private buildPaymentTemplateVariables(
    config: PaymentConfig | null,
    orderId?: string,
  ): Partial<TemplateVariables> {
    const paymentDetails = resolvePreferredPaymentDetails(config);

    return {
      '#{결제수단명}': paymentDetails.label,
      '#{결제계정}': paymentDetails.account,
      '#{수취인명}': paymentDetails.recipient,
      '#{은행명}': paymentDetails.label,
      '#{계좌번호}': paymentDetails.account,
      '#{예금주}': paymentDetails.recipient,
      '#{주문상세URL}': orderId ? `${this.frontendUrl}/orders/${orderId}` : '',
    };
  }

  private buildOrderConfirmationVariables(
    orderId: string,
    total: number,
    order: {
      user: { name: string | null } | null;
      orderItems: Array<{ productName: string }>;
    } | null,
    config: PaymentConfig | null,
  ): TemplateVariables {
    const customerName = order?.user?.name ?? '고객';
    const firstItem = order?.orderItems?.[0]?.productName ?? '상품';
    const itemCount = order?.orderItems?.length ?? 1;

    return this.buildTemplateVariables('ORDER_CONFIRMATION', {
      '#{고객명}': customerName,
      '#{주문번호}': orderId,
      '#{상품명}': firstItem,
      '#{수량}': String(itemCount),
      '#{금액}': total.toLocaleString(),
      ...this.buildPaymentTemplateVariables(config, orderId),
    });
  }

  private buildPaymentReminderVariables(
    orderId: string,
    total: number,
    customerName: string | null | undefined,
    config: PaymentConfig | null,
  ): TemplateVariables {
    return this.buildTemplateVariables('PAYMENT_REMINDER', {
      '#{고객명}': customerName ?? '고객',
      '#{주문번호}': orderId,
      '#{금액}': total.toLocaleString(),
      ...this.buildPaymentTemplateVariables(config, orderId),
    });
  }

  private buildCartExpiringVariables(
    customerName: string,
    productName: string,
    itemCount: number,
  ): TemplateVariables {
    return this.buildTemplateVariables('CART_EXPIRING', {
      '#{고객명}': customerName,
      '#{상품명}': productName,
      '#{수량}': String(itemCount),
    });
  }

  private buildLiveStartVariables(
    streamTitle: string,
    streamUrl: string,
    streamDescription?: string,
  ): TemplateVariables {
    return this.buildTemplateVariables('LIVE_START', {
      '#{쇼핑몰명}': LIVE_START_MARKET_NAME,
      '#{라이브주제}': streamTitle,
      '#{상세내용}': streamDescription ?? streamTitle,
      '#{방송URL}': streamUrl,
    });
  }

  /** Public: checks isEnabled, then sends in parallel chunks */
  async sendAlimtalk(messages: AlimtalkMessage[]): Promise<void> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return;
    }
    await this._sendAlimtalk(messages);
  }

  /** Internal: skips isEnabled check (caller is responsible) */
  private async _sendAlimtalk(messages: AlimtalkMessage[]): Promise<void> {
    if (!this.bizgo?.send) {
      this.logger.warn('Bizgo SDK not available, skipping send');
      return;
    }

    for (let i = 0; i < messages.length; i += SEND_CONCURRENCY) {
      const chunk = messages.slice(i, i + SEND_CONCURRENCY);
      await Promise.all(chunk.map((msg) => this._sendSingle(msg)));
    }
  }

  private async _sendSingle(msg: AlimtalkMessage): Promise<void> {
    try {
      const alimtalkBuilder = new AlimtalkBuilder()
        .setSenderKey(this.senderKey)
        .setMsgType('AT')
        .setTemplateCode(msg.templateCode)
        .setText(msg.text);

      if (msg.buttons?.length) {
        const buttons = msg.buttons.map((btn) =>
          new KakaoButtonBuilder()
            .setType(btn.buttonType)
            .setName(btn.buttonName)
            .setUrlMobile(btn.linkMo)
            .setUrlPc(btn.linkPc ?? btn.linkMo)
            .build(),
        );
        const attachment = new AlimtalkAttachmentBuilder().setButton(buttons).build();
        alimtalkBuilder.setAttachment(attachment);
      }

      const alimtalk = alimtalkBuilder.build();
      const destination = new DestinationBuilder().setTo(msg.to).build();

      const request = new OMNIRequestBodyBuilder()
        .setDestinations([destination])
        .setMessageFlow([{ alimtalk }])
        .build();

      const result = await this.bizgo!.send!.OMNI(request);
      const dest = result?.data?.data?.destinations?.[0];

      if (dest?.code === 'A000') {
        this.logger.log(`Alimtalk sent to ${msg.to}`, { msgKey: dest.msgKey });
      } else {
        this.logger.warn(`Alimtalk send returned code ${dest?.code}: ${dest?.result}`, {
          to: msg.to,
        });
      }
    } catch (error: unknown) {
      this.logSendError('send alimtalk', error);
    }
  }

  private buildOrderMessage(
    phone: string,
    orderId: string,
    total: number,
    order: {
      user: { name: string | null } | null;
      orderItems: Array<{ productName: string }>;
    } | null,
    config: PaymentConfig | null,
    template: OrderTemplate,
  ): AlimtalkMessage {
    const text = renderTemplate(
      template.template,
      this.buildOrderConfirmationVariables(orderId, total, order, config),
    );

    return {
      to: phone,
      templateCode: template.kakaoTemplateCode,
      text,
      buttons: [
        {
          buttonType: 'WL',
          buttonName: '주문 상세 보기',
          linkMo: `${this.frontendUrl}/orders/${orderId}`,
        },
      ],
    };
  }

  async sendOrderAlimtalk(phone: string, orderId: string, total: number): Promise<void> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return;
    }

    const [template, order, config] = await Promise.all([
      this.prisma.notificationTemplate.findFirst({ where: { type: 'ORDER_CONFIRMATION' } }),
      this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { name: true } },
          orderItems: { select: { productName: true }, orderBy: { productName: 'asc' } },
        },
      }),
      this.prisma.systemConfig.findFirst({ where: { id: 'system' } }),
    ]);

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('ORDER_CONFIRMATION template code not configured, skipping');
      return;
    }

    const msg = this.buildOrderMessage(phone, orderId, total, order, config, template);
    await this._sendAlimtalk([msg]);
  }

  /** Batch send for multiple orders — fetches template + config once instead of N times */
  async sendOrderAlimtalkBatch(orders: OrderAlimtalkData[]): Promise<void> {
    if (orders.length === 0) {
      return;
    }

    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping batch send');
      return;
    }

    const [template, config] = await Promise.all([
      this.prisma.notificationTemplate.findFirst({ where: { type: 'ORDER_CONFIRMATION' } }),
      this.prisma.systemConfig.findFirst({ where: { id: 'system' } }),
    ]);

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('ORDER_CONFIRMATION template code not configured, skipping');
      return;
    }

    const messages = orders
      .filter((o) => o.user?.kakaoPhone)
      .map((o) =>
        this.buildOrderMessage(o.user!.kakaoPhone!, o.id, Number(o.total), o, config, template),
      );

    await this._sendAlimtalk(messages);
  }

  async sendPaymentReminderAlimtalk(phone: string, orderId: string, total: number): Promise<void> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return;
    }

    const [template, order, config] = await Promise.all([
      this.prisma.notificationTemplate.findFirst({
        where: { type: 'PAYMENT_REMINDER' },
      }),
      this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { name: true } },
        },
      }),
      this.prisma.systemConfig.findFirst({ where: { id: 'system' } }),
    ]);

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('PAYMENT_REMINDER template code not configured, skipping');
      return;
    }

    const text = renderTemplate(
      template.template,
      this.buildPaymentReminderVariables(orderId, total, order?.user?.name, config),
    );

    await this._sendAlimtalk([
      {
        to: phone,
        templateCode: template.kakaoTemplateCode,
        text,
        buttons: [
          {
            buttonType: 'WL',
            buttonName: '주문 확인하기',
            linkMo: `${this.frontendUrl}/orders/${orderId}`,
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
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return;
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'CART_EXPIRING' },
    });

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('CART_EXPIRING template code not configured, skipping');
      return;
    }

    const text = renderTemplate(
      template.template,
      this.buildCartExpiringVariables(customerName, productName, itemCount),
    );

    await this._sendAlimtalk([
      {
        to: phone,
        templateCode: template.kakaoTemplateCode,
        text,
        buttons: [
          {
            buttonType: 'WL',
            buttonName: '장바구니 확인',
            linkMo: `${this.frontendUrl}/cart`,
            linkPc: `${this.frontendUrl}/cart`,
          },
        ],
      },
    ]);
  }

  async sendCartReminderFriendtalk(
    phone: string,
    productName: string,
    minutesLeft: number,
    streamKey?: string,
  ): Promise<void> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk/Friendtalk disabled, skipping send');
      return;
    }

    if (!this.bizgo?.send) {
      this.logger.warn('Bizgo SDK not available, skipping friendtalk send');
      return;
    }

    const cartUrl = streamKey
      ? `${this.frontendUrl}/live/${streamKey}`
      : `${this.frontendUrl}/cart`;

    const text = `장바구니에 담긴 "${productName}" 구매를 잊지 마세요!\n\n⏰ 장바구니 만료까지 약 ${minutesLeft}분 남았습니다.\n지금 바로 결제를 완료해보세요.`;

    try {
      const button = new KakaoButtonBuilder()
        .setType('WL')
        .setName('지금 결제하기')
        .setUrlMobile(cartUrl)
        .setUrlPc(cartUrl)
        .build();

      const attachment = new BrandMessageAttachmentBuilder().setButton([button]).build();

      const friendtalk = new BrandMessageBuilder()
        .setSenderKey(this.senderKey)
        .setSendType('free')
        .setMsgType('FT')
        .setText(text)
        .setAttachment(attachment)
        .setAdFlag('Y')
        .build();

      const destination = new DestinationBuilder().setTo(phone).build();

      const request = new OMNIRequestBodyBuilder()
        .setDestinations([destination])
        .setMessageFlow([{ brandmessage: friendtalk }])
        .build();

      const result = await this.bizgo.send.OMNI(request);
      const dest = result?.data?.data?.destinations?.[0];

      if (dest?.code === 'A000') {
        this.logger.log(`Cart reminder friendtalk sent to ${phone}`);
      } else {
        this.logger.warn(`Friendtalk send returned code ${dest?.code}: ${dest?.result}`, {
          to: phone,
        });
      }
    } catch (error: unknown) {
      this.logSendError('send cart reminder friendtalk', error);
    }
  }

  async sendLiveStartAlimtalk(
    phoneNumbers: string[],
    streamTitle: string,
    streamUrl: string,
    streamDescription?: string,
  ): Promise<void> {
    if (phoneNumbers.length === 0) {
      return;
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'LIVE_START' },
    });

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('LIVE_START template code not configured');
      return;
    }

    const text = renderTemplate(
      template.template,
      this.buildLiveStartVariables(streamTitle, streamUrl, streamDescription),
    );

    const messages: AlimtalkMessage[] = phoneNumbers.map((phone) => ({
      to: phone,
      templateCode: template.kakaoTemplateCode,
      text,
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
