import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { BusinessExceptionFilter } from './business-exception.filter';
import { BusinessException, UnauthorizedException } from '../exceptions/business.exception';

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
const mockSwitchToHttp = jest.fn().mockReturnValue({ getResponse: mockGetResponse });

const mockHost = {
  switchToHttp: mockSwitchToHttp,
} as unknown as ArgumentsHost;

describe('BusinessExceptionFilter', () => {
  let filter: BusinessExceptionFilter;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    filter = new BusinessExceptionFilter();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test'; // reset to non-production before each test
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('HttpException handling', () => {
    it('should return correct status and body for HttpException', () => {
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should include timestamp in response', () => {
      const exception = new HttpException('Test error', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      const response = mockJson.mock.calls[0][0];
      expect(response).toHaveProperty('timestamp');
      expect(typeof response.timestamp).toBe('string');
    });
  });

  describe('BusinessException handling', () => {
    it('should include errorCode in response', () => {
      const exception = new BusinessException('PRODUCT_NOT_FOUND', { productId: 'p-1' });

      filter.catch(exception, mockHost);

      const response = mockJson.mock.calls[0][0];
      expect(response.errorCode).toBe('PRODUCT_NOT_FOUND');
    });

    it('should strip context in PRODUCTION to prevent internal ID leakage', () => {
      process.env.NODE_ENV = 'production'; // isProduction getter reads this at call time

      const exception = new BusinessException('INSUFFICIENT_STOCK', {
        productId: 'p-1',
        available: 5,
        requested: 10,
      });

      filter.catch(exception, mockHost);

      const response = mockJson.mock.calls[0][0];
      expect(response).not.toHaveProperty('context');
    });

    it('should expose context in non-production for debugging', () => {
      process.env.NODE_ENV = 'development'; // non-production

      const exception = new BusinessException('INSUFFICIENT_STOCK', {
        productId: 'p-1',
        available: 5,
      });

      filter.catch(exception, mockHost);

      const response = mockJson.mock.calls[0][0];
      expect(response.context).toBeDefined();
      expect(response.context).toEqual(expect.objectContaining({ productId: 'p-1' }));
    });
  });

  describe('UnauthorizedException handling', () => {
    it('should return 401 for UnauthorizedException', () => {
      const exception = new UnauthorizedException('Invalid token');

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('Generic Error handling (production guards)', () => {
    it('should return 500 status for unhandled Error', () => {
      const exception = new Error('Database connection failed');

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should NOT expose raw error message or stack in production', () => {
      process.env.NODE_ENV = 'production';

      const exception = new Error('Sensitive: DB password=secret123');

      filter.catch(exception, mockHost);

      const response = mockJson.mock.calls[0][0];
      expect(response.message).toBe('An unexpected error occurred');
      expect(JSON.stringify(response)).not.toContain('secret');
      expect(response).not.toHaveProperty('stack');
    });

    it('should expose message in development for debugging', () => {
      process.env.NODE_ENV = 'development';

      const exception = new Error('Dev debug info');

      filter.catch(exception, mockHost);

      const response = mockJson.mock.calls[0][0];
      expect(response.message).toBe('Dev debug info');
    });

    it('should always return success:false', () => {
      const exception = new Error('anything');

      filter.catch(exception, mockHost);

      const response = mockJson.mock.calls[0][0];
      expect(response.success).toBe(false);
    });
  });
});
