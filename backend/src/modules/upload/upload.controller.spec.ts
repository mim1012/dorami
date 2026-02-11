import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller';

describe('UploadController', () => {
  let controller: UploadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
    }).compile();

    controller = module.get<UploadController>(UploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadImage', () => {
    it('should return file metadata on successful upload', () => {
      const mockFile = {
        filename: 'abc-123.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const result = controller.uploadImage('user-123', mockFile);

      expect(result).toEqual({
        url: '/uploads/abc-123.jpg',
        filename: 'abc-123.jpg',
        size: 1024,
        mimetype: 'image/jpeg',
        uploadedBy: 'user-123',
        uploadedAt: expect.any(String),
      });
    });

    it('should throw BadRequestException when no file uploaded', () => {
      expect(() => {
        controller.uploadImage('user-123', undefined as any);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file is null', () => {
      expect(() => {
        controller.uploadImage('user-123', null as any);
      }).toThrow(BadRequestException);
    });

    it('should include correct upload URL path', () => {
      const mockFile = {
        filename: 'uuid-image.png',
        size: 2048,
        mimetype: 'image/png',
      } as Express.Multer.File;

      const result = controller.uploadImage('admin-1', mockFile);

      expect(result.url).toBe('/uploads/uuid-image.png');
      expect(result.uploadedBy).toBe('admin-1');
    });
  });
});
