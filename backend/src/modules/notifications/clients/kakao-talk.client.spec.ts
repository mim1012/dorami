import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { KakaoTalkClient } from './kakao-talk.client';
import { PrismaService } from '../../../common/prisma/prisma.service';

jest.mock('axios');

describe('KakaoTalkClient', () => {
  const post = jest.fn();
  const create = jest.fn(() => ({ post }));

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'KAKAOTALK_API_KEY') {
        return 'test-kakao-key';
      }

      return undefined;
    }),
  } as unknown as ConfigService;

  const prisma = {
    systemConfig: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock) = create;
    create.mockReturnValue({ post });
    post.mockResolvedValue({ data: {} });
  });

  it('skips custom Kakao sends when the global alimtalk toggle is off', async () => {
    (prisma.systemConfig.findFirst as jest.Mock).mockResolvedValue({ alimtalkEnabled: false });
    const client = new KakaoTalkClient(configService, prisma);

    await expect(client.sendCustomMessage('user-1', '제목', '본문')).resolves.toEqual({
      success: false,
    });

    expect(prisma.systemConfig.findFirst).toHaveBeenCalledWith({
      where: { id: 'system' },
      select: { alimtalkEnabled: true },
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('skips template Kakao sends when the global alimtalk toggle is off', async () => {
    (prisma.systemConfig.findFirst as jest.Mock).mockResolvedValue({ alimtalkEnabled: false });
    const client = new KakaoTalkClient(configService, prisma);

    await expect(
      client.sendTemplateMessage('user-1', 'template-1', { orderId: 'ORD-1' }),
    ).resolves.toEqual({ success: false });

    expect(post).not.toHaveBeenCalled();
  });

  it('sends custom Kakao messages when the global toggle is on', async () => {
    (prisma.systemConfig.findFirst as jest.Mock).mockResolvedValue({ alimtalkEnabled: true });
    const client = new KakaoTalkClient(configService, prisma);

    await expect(client.sendCustomMessage('user-1', '제목', '본문')).resolves.toEqual({
      success: true,
    });

    expect(post).toHaveBeenCalledTimes(1);
  });
});
