import { Test, TestingModule } from '@nestjs/testing';
import { NoticesService } from './notices.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('NoticesService', () => {
  let service: NoticesService;

  const mockNotice = {
    id: 'notice-1',
    title: '공지사항 제목',
    content: '공지사항 내용',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NoticesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<NoticesService>(NoticesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notice', async () => {
      const dto = { title: '공지사항 제목', content: '공지사항 내용' };
      mockPrisma.notice.create.mockResolvedValue(mockNotice);

      const result = await service.create(dto);

      expect(result).toEqual(mockNotice);
      expect(mockPrisma.notice.create).toHaveBeenCalledWith({ data: dto });
    });

    it('should create a notice with isActive flag', async () => {
      const dto = { title: '제목', content: '내용', isActive: false };
      mockPrisma.notice.create.mockResolvedValue({ ...mockNotice, isActive: false });

      const result = await service.create(dto);

      expect(result.isActive).toBe(false);
    });
  });

  describe('findAllAdmin', () => {
    it('should return all notices ordered by createdAt desc', async () => {
      const notices = [mockNotice, { ...mockNotice, id: 'notice-2', isActive: false }];
      mockPrisma.notice.findMany.mockResolvedValue(notices);

      const result = await service.findAllAdmin();

      expect(result).toHaveLength(2);
      expect(mockPrisma.notice.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no notices', async () => {
      mockPrisma.notice.findMany.mockResolvedValue([]);

      const result = await service.findAllAdmin();

      expect(result).toHaveLength(0);
    });
  });

  describe('findAllActive', () => {
    it('should return only active notices', async () => {
      mockPrisma.notice.findMany.mockResolvedValue([mockNotice]);

      const result = await service.findAllActive();

      expect(result).toHaveLength(1);
      expect(mockPrisma.notice.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a notice by id', async () => {
      mockPrisma.notice.findUnique.mockResolvedValue(mockNotice);

      const result = await service.findOne('notice-1');

      expect(result).toEqual(mockNotice);
      expect(mockPrisma.notice.findUnique).toHaveBeenCalledWith({
        where: { id: 'notice-1' },
      });
    });

    it('should return null when notice not found', async () => {
      mockPrisma.notice.findUnique.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a notice', async () => {
      const dto = { title: '수정된 제목' };
      mockPrisma.notice.update.mockResolvedValue({ ...mockNotice, title: '수정된 제목' });

      const result = await service.update('notice-1', dto);

      expect(result.title).toBe('수정된 제목');
      expect(mockPrisma.notice.update).toHaveBeenCalledWith({
        where: { id: 'notice-1' },
        data: dto,
      });
    });
  });

  describe('remove', () => {
    it('should delete a notice', async () => {
      mockPrisma.notice.delete.mockResolvedValue(mockNotice);

      const result = await service.remove('notice-1');

      expect(result).toEqual(mockNotice);
      expect(mockPrisma.notice.delete).toHaveBeenCalledWith({
        where: { id: 'notice-1' },
      });
    });
  });

  describe('getCurrentNotice', () => {
    it('should return notice config from system config', async () => {
      mockPrisma.systemConfig.findFirst.mockResolvedValue({
        id: 'system',
        noticeText: '현재 공지사항',
        noticeFontSize: 16,
        noticeFontFamily: 'Noto Sans KR',
      });

      const result = await service.getCurrentNotice();

      expect(result).toEqual({
        text: '현재 공지사항',
        fontSize: 16,
        fontFamily: 'Noto Sans KR',
      });
    });

    it('should return defaults when no config exists', async () => {
      mockPrisma.systemConfig.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentNotice();

      expect(result).toEqual({
        text: null,
        fontSize: 14,
        fontFamily: 'Pretendard',
      });
    });
  });
});
