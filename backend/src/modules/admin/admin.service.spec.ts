import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EncryptionService } from '../../common/services/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlimtalkService } from './alimtalk.service';
import { RedisService } from '../../common/redis/redis.service';
import { UserStatus } from '@live-commerce/shared-types';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
  let encryptionService: EncryptionService;
  let notificationsService: NotificationsService;
  let alimtalkService: AlimtalkService;

  const mockWebsocketGateway = {
    server: {
      emit: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            order: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn(),
              aggregate: jest.fn(),
              groupBy: jest.fn().mockResolvedValue([]),
            },
            user: {
              findMany: jest.fn(),
              count: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            chatMessage: {
              count: jest.fn(),
            },
            auditLog: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            systemConfig: {
              findFirst: jest.fn(),
              create: jest.fn(),
              upsert: jest.fn(),
            },
            orderItem: {
              groupBy: jest.fn(),
              delete: jest.fn(),
            },
            product: {
              update: jest.fn(),
            },
            liveStream: {
              count: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            decryptAddress: jest.fn(),
            encryptAddress: jest.fn(),
            tryDecryptAddress: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendPaymentConfirmation: jest.fn(),
            sendOrderStatusUpdate: jest.fn(),
            sendPaymentReminderNotification: jest.fn(),
          },
        },
        {
          provide: AlimtalkService,
          useValue: {
            sendOrderAlimtalk: jest.fn(),
            sendPaymentReminderAlimtalk: jest.fn(),
            sendLiveStartAlimtalk : jest.fn(),
            sendTestOrderFriendtalk: jest.fn(),
            sendTestPaymentReminder: jest.fn(),
            sendTestCartExpiring: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            del: jest.fn(),
            get: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: 'WEBSOCKET_GATEWAY',
          useValue: mockWebsocketGateway,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://www.doremi-live.com') },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    encryptionService = module.get<EncryptionService>(EncryptionService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    alimtalkService = module.get<AlimtalkService>(AlimtalkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });