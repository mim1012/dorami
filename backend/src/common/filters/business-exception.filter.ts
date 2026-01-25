import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class BusinessExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any = {
      success: false,
      timestamp: new Date().toISOString(),
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        errorResponse = {
          success: false,
          timestamp: new Date().toISOString(),
          ...(exceptionResponse as object),
        };
      } else {
        errorResponse = {
          success: false,
          timestamp: new Date().toISOString(),
          message: exceptionResponse,
        };
      }
    } else if (exception instanceof Error) {
      errorResponse = {
        success: false,
        timestamp: new Date().toISOString(),
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: exception.message,
        stack: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      };
    }

    response.status(status).json(errorResponse);
  }
}
