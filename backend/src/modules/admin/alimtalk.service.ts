import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AlimtalkMessage {
  to: string; // phone number e.g. "01012345678"
  templateCode: string;
  variables: Record<string, string>;
  buttons?: Array<{
    buttonType: 'WL'; // Web Link
    buttonName: string;
    linkMo: string;
    linkPc?: string;
  }>;
}

@Injectable()
export class AlimtalkService {
  private readonly logger = new Logger(AlimtalkService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendAlimtalk(messages: AlimtalkMessage[]): Promise<void> {
    const config = await this.prisma.systemConfig.findFirst({ where: { id: 'system' } });

    if (!config?.alimtalkEnabled) {
      this.logger.debug('Alimtalk disabled, skipping send');
      return;
    }

    if (!config.solapiApiKey || !config.solapiApiSecret || !config.kakaoChannelId) {
      this.logger.warn('Alimtalk config incomplete, skipping send');
      return;
    }

    try {
      const timestamp = Date.now().toString();
      const salt = Math.random().toString(36).substring(2);
      const hmacData = timestamp + salt;

      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', config.solapiApiSecret)
        .update(hmacData)
        .digest('hex');

      const payload = {
        messages: messages.map((msg) => ({
          to: msg.to,
          from: config.kakaoChannelId,
          kakaoOptions: {
            pfId: config.kakaoChannelId,
            templateId: msg.templateCode,
            variables: msg.variables,
            buttons: msg.buttons,
          },
        })),
      };

      const response = await fetch('https://api.solapi.com/messages/v4/send-many', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `HMAC-SHA256 apiKey=${config.solapiApiKey}, date=${timestamp}, salt=${salt}, signature=${signature}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error('Solapi send failed', error);
        return;
      }

      this.logger.log(`Alimtalk sent to ${messages.length} recipients`);
    } catch (error) {
      this.logger.error('Failed to send alimtalk', error);
    }
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
      variables: {
        '#{streamTitle}': streamTitle,
      },
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
