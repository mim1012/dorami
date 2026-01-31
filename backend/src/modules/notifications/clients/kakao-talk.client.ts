import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class KakaoTalkClient {
  private client: AxiosInstance;
  private logger: LoggerService;

  constructor(private configService: ConfigService) {
    this.logger = new LoggerService();
    this.logger.setContext('KakaoTalkClient');

    this.client = axios.create({
      baseURL: 'https://kapi.kakao.com',
      headers: {
        Authorization: `KakaoAK ${configService.get('KAKAOTALK_API_KEY')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 5000,
    });
  }

  async sendTemplateMessage(
    userId: string,
    templateId: string,
    variables: Record<string, string>,
  ): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post('/v2/api/talk/memo/default/send', {
        template_id: templateId,
        template_args: JSON.stringify(variables),
      });

      this.logger.log(`KakaoTalk message sent to user ${userId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send KakaoTalk message to user ${userId}`, error.message);
      throw error;
    }
  }

  async sendCustomMessage(
    userId: string,
    title: string,
    description: string,
    link?: string,
  ): Promise<{ success: boolean }> {
    try {
      const template = {
        object_type: 'text',
        text: description,
        link: link
          ? {
              web_url: link,
              mobile_web_url: link,
            }
          : undefined,
      };

      await this.client.post('/v2/api/talk/memo/default/send', {
        template_object: JSON.stringify(template),
      });

      this.logger.log(`Custom KakaoTalk message sent to user ${userId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send custom message to user ${userId}`, error.message);
      throw error;
    }
  }
}
