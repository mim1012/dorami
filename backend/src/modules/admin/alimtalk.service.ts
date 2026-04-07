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
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateOrderId } from '@live-commerce/shared-types';

interface AlimtalkMessage {
  to: string; // phone number e.g. "01012345678"
  templateCode?: string; // required for alimtalk, not needed for friendtalk
  text: string; // full message body
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
  kakaoTemplateCode?: string | null;
}

const SEND_CONCURRENCY = 10;

export type KakaoMessageChannel = 'AT' | 'FT';
export type KakaoDeliveryStatus = 'sent' | 'failed' | 'skipped';

export interface KakaoDeliveryResult {
  status: KakaoDeliveryStatus;
  channel: KakaoMessageChannel;
  recipient: string;
  providerCode?: string;
  providerMessage?: string;
  providerMessageKey?: string;
  reason?: string;
}

export interface KakaoDeliveryBatchResult {
  results: KakaoDeliveryResult[];
  totals: {
    sent: number;
    failed: number;
    skipped: number;
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

  private buildBatchResult(results: KakaoDeliveryResult[]): KakaoDeliveryBatchResult {
    return {
      results,
      totals: {
        sent: results.filter((result) => result.status === 'sent').length,
        failed: results.filter((result) => result.status === 'failed').length,
        skipped: results.filter((result) => result.status === 'skipped').length,
      },
    };
  }

  private buildSkippedResult(
    channel: KakaoMessageChannel,
    recipient: string,
    reason: string,
  ): KakaoDeliveryResult {
    return {
      status: 'skipped',
      channel,
      recipient,
      reason,
    };
  }

  private buildFailureResult(
    channel: KakaoMessageChannel,
    recipient: string,
    reason: string,
    providerCode?: string,
    providerMessage?: string,
  ): KakaoDeliveryResult {
    return {
      status: 'failed',
      channel,
      recipient,
      reason,
      providerCode,
      providerMessage,
    };
  }

  private extractDestinationResult(result: unknown): {
    code?: string;
    result?: string;
    msgKey?: string;
  } {
    const response = result as {
      data?: {
        data?: {
          destinations?: Array<{
            code?: string;
            result?: string;
            msgKey?: string;
          }>;
        };
      };
    };

    return response?.data?.data?.destinations?.[0] ?? {};
  }

  /** Public: checks isEnabled, then sends in parallel chunks */
  async sendAlimtalk(messages: AlimtalkMessage[]): Promise<KakaoDeliveryBatchResult> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return this.buildBatchResult(
        messages.map((message) => this.buildSkippedResult('AT', message.to, 'disabled')),
      );
    }
    return this._sendAlimtalk(messages);
  }

  /** Internal: skips isEnabled check (caller is responsible) */
  private async _sendAlimtalk(messages: AlimtalkMessage[]): Promise<KakaoDeliveryBatchResult> {
    if (!this.bizgo?.send) {
      this.logger.warn('Bizgo SDK not available, skipping send');
      return this.buildBatchResult(
        messages.map((message) => this.buildSkippedResult('AT', message.to, 'provider_unavailable')),
      );
    }

    const results: KakaoDeliveryResult[] = [];
    for (let i = 0; i < messages.length; i += SEND_CONCURRENCY) {
      const chunk = messages.slice(i, i + SEND_CONCURRENCY);
      results.push(...(await Promise.all(chunk.map((msg) => this._sendSingle(msg)))));
    }
    return this.buildBatchResult(results);
  }

  private async _sendOrderFriendtalks(
    messages: AlimtalkMessage[],
  ): Promise<KakaoDeliveryBatchResult> {
    if (!this.bizgo?.send) {
      this.logger.warn('Bizgo SDK not available, skipping send');
      return this.buildBatchResult(
        messages.map((message) => this.buildSkippedResult('FT', message.to, 'provider_unavailable')),
      );
    }
    const results: KakaoDeliveryResult[] = [];
    for (let i = 0; i < messages.length; i += SEND_CONCURRENCY) {
      const chunk = messages.slice(i, i + SEND_CONCURRENCY);
      results.push(...(await Promise.all(chunk.map((msg) => this._sendSingleOrderFriendtalk(msg)))));
    }
    return this.buildBatchResult(results);
  }

  private async _sendSingleOrderFriendtalk(msg: AlimtalkMessage): Promise<KakaoDeliveryResult> {
    try {
      const friendtalkBuilder = new BrandMessageBuilder()
        .setSenderKey(this.senderKey)
        .setSendType('free')
        .setMsgType('FT')
        .setText(msg.text)
        .setAdFlag('N');

      if (msg.buttons?.length) {
        const buttons = msg.buttons.map((btn) =>
          new KakaoButtonBuilder()
            .setType(btn.buttonType)
            .setName(btn.buttonName)
            .setUrlMobile(btn.linkMo)
            .setUrlPc(btn.linkPc ?? btn.linkMo)
            .build(),
        );
        friendtalkBuilder.setAttachment(
          new BrandMessageAttachmentBuilder().setButton(buttons).build(),
        );
      }

      const friendtalk = friendtalkBuilder.build();
      const destination = new DestinationBuilder().setTo(msg.to).build();

      const request = new OMNIRequestBodyBuilder()
        .setDestinations([destination])
        .setMessageFlow([{ brandmessage: friendtalk }])
        .build();

      const result = await this.bizgo!.send!.OMNI(request);
      this.logger.log(`Bizgo raw response: ${JSON.stringify(result?.data)}`);
      const dest = this.extractDestinationResult(result);

      if (dest?.code === 'A000') {
        this.logger.log(`Order friendtalk sent to ${msg.to}`, { msgKey: dest.msgKey });
        return {
          status: 'sent',
          channel: 'FT',
          recipient: msg.to,
          providerCode: dest.code,
          providerMessage: dest.result,
          providerMessageKey: dest.msgKey,
        };
      } else {
        this.logger.warn(`Order friendtalk returned code ${dest?.code}: ${dest?.result}`, {
          to: msg.to,
        });
        return this.buildFailureResult(
          'FT',
          msg.to,
          'provider_rejected',
          dest?.code,
          dest?.result,
        );
      }
    } catch (error: unknown) {
      this.logSendError('send order friendtalk', error);
      return this.buildFailureResult('FT', msg.to, 'provider_error');
    }
  }

  private async _sendSingle(msg: AlimtalkMessage): Promise<KakaoDeliveryResult> {
    try {
      const alimtalkBuilder = new AlimtalkBuilder()
        .setSenderKey(this.senderKey)
        .setMsgType('AT')
        .setTemplateCode(msg.templateCode ?? '')
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
      this.logger.log(`Bizgo raw response: ${JSON.stringify(result?.data)}`);
      const dest = this.extractDestinationResult(result);

      if (dest?.code === 'A000') {
        this.logger.log(`Alimtalk sent to ${msg.to}`, { msgKey: dest.msgKey });
        return {
          status: 'sent',
          channel: 'AT',
          recipient: msg.to,
          providerCode: dest.code,
          providerMessage: dest.result,
          providerMessageKey: dest.msgKey,
        };
      } else {
        this.logger.warn(`Alimtalk send returned code ${dest?.code}: ${dest?.result}`, {
          to: msg.to,
        });
        return this.buildFailureResult(
          'AT',
          msg.to,
          'provider_rejected',
          dest?.code,
          dest?.result,
        );
      }
    } catch (error: unknown) {
      this.logSendError('send alimtalk', error);
      return this.buildFailureResult('AT', msg.to, 'provider_error');
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
    const customerName = order?.user?.name ?? '고객';
    const firstItem = order?.orderItems?.[0]?.productName ?? '상품';
    const itemCount = order?.orderItems?.length ?? 1;

    let paymentLabel: string;
    let paymentAccount: string;
    let paymentHolder: string;
    if (config?.zelleEmail) {
      paymentLabel = 'Zelle';
      paymentAccount = config.zelleEmail;
      paymentHolder = config.zelleRecipientName ?? '';
    } else if (config?.venmoEmail) {
      paymentLabel = 'Venmo';
      paymentAccount = config.venmoEmail;
      paymentHolder = config.venmoRecipientName ?? '';
    } else {
      paymentLabel = config?.bankName ?? '';
      paymentAccount = config?.bankAccountNumber ?? '';
      paymentHolder = config?.bankAccountHolder ?? '';
    }

    const text = template.template
      .replace('#{고객명}', customerName)
      .replace('#{주문번호}', orderId)
      .replace('#{상품명}', firstItem)
      .replace('#{수량}', String(itemCount))
      .replace('#{금액}', total.toLocaleString())
      .replace('#{은행명}', paymentLabel)
      .replace('#{계좌번호}', paymentAccount)
      .replace('#{예금주}', paymentHolder);

    return {
      to: phone,
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

  async sendOrderAlimtalk(
    phone: string,
    orderId: string,
    total: number,
  ): Promise<KakaoDeliveryBatchResult> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return this.buildBatchResult([this.buildSkippedResult('FT', phone, 'disabled')]);
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

    if (!template?.template) {
      this.logger.warn('ORDER_CONFIRMATION template text not configured, skipping');
      return this.buildBatchResult([this.buildSkippedResult('FT', phone, 'template_missing')]);
    }

    const msg = this.buildOrderMessage(phone, orderId, total, order, config, template);
    return this._sendOrderFriendtalks([msg]);
  }

  /** Batch send for multiple orders — fetches template + config once instead of N times */
  async sendOrderAlimtalkBatch(orders: OrderAlimtalkData[]): Promise<KakaoDeliveryBatchResult> {
    if (orders.length === 0) {
      return this.buildBatchResult([]);
    }

    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping batch send');
      return this.buildBatchResult(
        orders
          .map((order) => order.user?.kakaoPhone)
          .filter((phone): phone is string => !!phone)
          .map((phone) => this.buildSkippedResult('FT', phone, 'disabled')),
      );
    }

    const [template, config] = await Promise.all([
      this.prisma.notificationTemplate.findFirst({ where: { type: 'ORDER_CONFIRMATION' } }),
      this.prisma.systemConfig.findFirst({ where: { id: 'system' } }),
    ]);

    if (!template?.template) {
      this.logger.warn('ORDER_CONFIRMATION template text not configured, skipping');
      return this.buildBatchResult(
        orders
          .map((order) => order.user?.kakaoPhone)
          .filter((phone): phone is string => !!phone)
          .map((phone) => this.buildSkippedResult('FT', phone, 'template_missing')),
      );
    }

    const messages = orders
      .filter((o) => o.user?.kakaoPhone)
      .map((o) =>
        this.buildOrderMessage(o.user!.kakaoPhone!, o.id, Number(o.total), o, config, template),
      );

    return this._sendOrderFriendtalks(messages);
  }

  async sendPaymentReminderAlimtalk(
    phone: string,
    orderId: string,
    total: number,
  ): Promise<KakaoDeliveryBatchResult> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return this.buildBatchResult([this.buildSkippedResult('AT', phone, 'disabled')]);
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'PAYMENT_REMINDER' },
    });

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('PAYMENT_REMINDER template code not configured, skipping');
      return this.buildBatchResult([this.buildSkippedResult('AT', phone, 'template_code_missing')]);
    }

    const text = template.template
      .replace('#{주문번호}', orderId)
      .replace('#{금액}', total.toLocaleString());

    return this._sendAlimtalk([
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
  ): Promise<KakaoDeliveryBatchResult> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return this.buildBatchResult([this.buildSkippedResult('AT', phone, 'disabled')]);
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'CART_EXPIRING' },
    });

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('CART_EXPIRING template code not configured, skipping');
      return this.buildBatchResult([this.buildSkippedResult('AT', phone, 'template_code_missing')]);
    }

    const text = template.template
      .replace('#{고객명}', customerName)
      .replace('#{상품명}', productName)
      .replace('#{수량}', String(itemCount));

    return this._sendAlimtalk([
      {
        to: phone,
        templateCode: template.kakaoTemplateCode,
        text,
      },
    ]);
  }

  async sendCartReminderFriendtalk(
    phone: string,
    productName: string,
    minutesLeft: number,
    streamKey?: string,
  ): Promise<KakaoDeliveryBatchResult> {
    if (!(await this.isEnabled())) {
      this.logger.debug('Alimtalk/Friendtalk disabled, skipping send');
      return this.buildBatchResult([this.buildSkippedResult('FT', phone, 'disabled')]);
    }

    if (!this.bizgo?.send) {
      this.logger.warn('Bizgo SDK not available, skipping friendtalk send');
      return this.buildBatchResult([this.buildSkippedResult('FT', phone, 'provider_unavailable')]);
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
      const dest = this.extractDestinationResult(result);

      if (dest?.code === 'A000') {
        this.logger.log(`Cart reminder friendtalk sent to ${phone}`);
        return this.buildBatchResult([
          {
            status: 'sent',
            channel: 'FT',
            recipient: phone,
            providerCode: dest.code,
            providerMessage: dest.result,
            providerMessageKey: dest.msgKey,
          },
        ]);
      } else {
        this.logger.warn(`Friendtalk send returned code ${dest?.code}: ${dest?.result}`, {
          to: phone,
        });
        return this.buildBatchResult([
          this.buildFailureResult('FT', phone, 'provider_rejected', dest?.code, dest?.result),
        ]);
      }
    } catch (error: unknown) {
      this.logSendError('send cart reminder friendtalk', error);
      return this.buildBatchResult([this.buildFailureResult('FT', phone, 'provider_error')]);
    }
  }

  async sendLiveStartAlimtalk(
    phoneNumbers: string[],
    streamTitle: string,
    streamUrl: string,
    streamDescription?: string,
  ): Promise<KakaoDeliveryBatchResult> {
    if (phoneNumbers.length === 0) {
      return this.buildBatchResult([]);
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'LIVE_START' },
    });

    if (!template?.kakaoTemplateCode) {
      this.logger.warn('LIVE_START template code not configured');
      return this.buildBatchResult(
        phoneNumbers.map((phone) => this.buildSkippedResult('AT', phone, 'template_code_missing')),
      );
    }

    const text = template.template
      .replace('#{쇼핑몰명}', '도레미마켓')
      .replace('#{라이브주제}', streamTitle)
      .replace('#{상세내용}', streamDescription ?? streamTitle)
      .replace('#{방송URL}', streamUrl);

    const messages: AlimtalkMessage[] = phoneNumbers.map((phone) => ({
      to: phone,
      templateCode: template.kakaoTemplateCode,
      text,
    }));

    return this.sendAlimtalk(messages);
  }

  async sendTestOrderFriendtalk(phone: string): Promise<KakaoDeliveryBatchResult> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { type: 'ORDER_CONFIRMATION' },
    });

    if (!template?.template) {
      this.logger.warn('ORDER_CONFIRMATION template not configured, skipping test');
      return this.buildBatchResult([this.buildSkippedResult('FT', phone, 'template_missing')]);
    }

    const testOrderId = generateOrderId(1);
    const msg = this.buildOrderMessage(
      phone,
      testOrderId,
      50000,
      { user: { name: '테스트' }, orderItems: [{ productName: '테스트 상품' }] },
      {
        bankName: 'KB국민은행',
        bankAccountNumber: '123-456-789',
        bankAccountHolder: '도레미마켓',
      } as PaymentConfig,
      template,
    );
    return this._sendOrderFriendtalks([msg]);
  }

  async sendTestPaymentReminder(phone: string): Promise<KakaoDeliveryBatchResult> {
    return this.sendPaymentReminderAlimtalk(phone, 'TEST-001', 50000);
  }

  async sendTestCartExpiring(phone: string): Promise<KakaoDeliveryBatchResult> {
    return this.sendCartExpiringAlimtalk(phone, '테스트 고객', '테스트 상품', 1);
  }
}
