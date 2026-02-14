import { Test, TestingModule } from '@nestjs/testing';
import { NoticesService } from './notices.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';

describe('NoticesService', () => {
  let service: NoticesService;
  let prismaService: PrismaService;

  const mockNotice = {
    id: 'notice-1',
    title: 'Test Notice',
    content: 'Test content',
    isActive: true,
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  };

  const mockSystemConfig = {
    id: 'system',
    noticeText: 'Welcome to Live Commerce',
    noticeFontSize: 16,
    noticeFontFamily: 'Pretendard',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticesService,
        {
          provide: PrismaService,
          useValue: {
            notice: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            systemConfig: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NoticesService>(NoticesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call prisma.notice.create with dto', async () => {
      const createDto: CreateNoticeDto = {
        title: 'Test Notice',
        content: 'Test content',
        isActive: true,
      };

      jest.spyOn(prismaService.notice, 'create').mockResolvedValue(mockNotice as any);

      const result = await service.create(createDto);

      expect(prismaService.notice.create).toHaveBeenCalledWith({
        data: createDto,
      });
      expect(result).toEqual(mockNotice);
    });
  });

  describe('findAllAdmin', () => {
    it('should return all notices ordered by createdAt desc', async () => {
      const mockNotices = [
        { ...mockNotice, id: 'notice-2', createdAt: new Date('2026-02-14') },
        { ...mockNotice, id: 'notice-1', createdAt: new Date('2026-02-01') },
      ];

      jest.spyOn(prismaService.notice, 'findMany').mockResolvedValue(mockNotices as any);

      const result = await service.findAllAdmin();

      expect(prismaService.notice.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockNotices);
    });
  });

  describe('findAllActive', () => {
    it('should return only active notices', async () => {
      const mockActiveNotices = [
        { ...mockNotice, id: 'notice-1', isActive: true },
        { ...mockNotice, id: 'notice-2', isActive: true },
      ];

      jest.spyOn(prismaService.notice, 'findMany').mockResolvedValue(mockActiveNotices as any);

      const result = await service.findAllActive();

      expect(prismaService.notice.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockActiveNotices);
    });
  });

  describe('findOne', () => {
    it('should return notice by id', async () => {
      jest.spyOn(prismaService.notice, 'findUnique').mockResolvedValue(mockNotice as any);

      const result = await service.findOne('notice-1');

      expect(prismaService.notice.findUnique).toHaveBeenCalledWith({
        where: { id: 'notice-1' },
      });
      expect(result).toEqual(mockNotice);
    });

    it('should return null for nonexistent notice', async () => {
      jest.spyOn(prismaService.notice, 'findUnique').mockResolvedValue(null);

      const result = await service.findOne('nonexistent-id');

      expect(prismaService.notice.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent-id' },
      });
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should call prisma.notice.update with id and dto', async () => {
      const updateDto: UpdateNoticeDto = {
        title: 'Updated Notice',
        isActive: false,
      };

      const updatedNotice = {
        ...mockNotice,
        ...updateDto,
        updatedAt: new Date('2026-02-14'),
      };

      jest.spyOn(prismaService.notice, 'update').mockResolvedValue(updatedNotice as any);

      const result = await service.update('notice-1', updateDto);

      expect(prismaService.notice.update).toHaveBeenCalledWith({
        where: { id: 'notice-1' },
        data: updateDto,
      });
      expect(result).toEqual(updatedNotice);
    });
  });

  describe('remove', () => {
    it('should call prisma.notice.delete with id', async () => {
      jest.spyOn(prismaService.notice, 'delete').mockResolvedValue(mockNotice as any);

      const result = await service.remove('notice-1');

      expect(prismaService.notice.delete).toHaveBeenCalledWith({
        where: { id: 'notice-1' },
      });
      expect(result).toEqual(mockNotice);
    });
  });

  describe('getCurrentNotice', () => {
    it('should return config values when system config exists', async () => {
      jest
        .spyOn(prismaService.systemConfig, 'findFirst')
        .mockResolvedValue(mockSystemConfig as any);

      const result = await service.getCurrentNotice();

      expect(prismaService.systemConfig.findFirst).toHaveBeenCalledWith({
        where: { id: 'system' },
      });
      expect(result).toEqual({
        text: 'Welcome to Live Commerce',
        fontSize: 16,
        fontFamily: 'Pretendard',
      });
    });

    it('should return defaults when no config exists', async () => {
      jest.spyOn(prismaService.systemConfig, 'findFirst').mockResolvedValue(null);

      const result = await service.getCurrentNotice();

      expect(prismaService.systemConfig.findFirst).toHaveBeenCalledWith({
        where: { id: 'system' },
      });
      expect(result).toEqual({
        text: null,
        fontSize: 14,
        fontFamily: 'Pretendard',
      });
    });
  });
});
