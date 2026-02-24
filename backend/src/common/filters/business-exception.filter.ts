import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class BusinessExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BusinessExceptionFilter.name);

  /** Evaluated at request time so tests can toggle NODE_ENV without module reloads */
  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: Record<string, unknown> = {
      success: false,
      timestamp: new Date().toISOString(),
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        // Strip `context` in production to avoid leaking internal IDs / stock counts
        const {
          context,
          stack: _stack,
          ...safeFields
        } = exceptionResponse as Record<string, unknown>;
        errorResponse = {
          success: false,
          timestamp: new Date().toISOString(),
          ...safeFields,
          // Expose context only in non-production environments
          ...(this.isProduction ? {} : { context }),
        };
      } else {
        errorResponse = {
          success: false,
          timestamp: new Date().toISOString(),
          message: exceptionResponse as string,
        };
      }
    } else if (exception instanceof Error) {
      // Log the real error server-side but never expose raw message/stack to clients
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
      errorResponse = {
        success: false,
        timestamp: new Date().toISOString(),
        errorCode: 'INTERNAL_SERVER_ERROR',
        // In production return a generic message; in dev expose the real one for debugging
        message: this.isProduction ? 'An unexpected error occurred' : exception.message,
        ...(this.isProduction ? {} : { stack: exception.stack }),
      };
    } else {
      this.logger.error('Unhandled non-Error exception', JSON.stringify(exception));
    }

    response.status(status).json(errorResponse);
  }
}
