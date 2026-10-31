import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../application/application.error.js';
import { TooManyRequestsError } from '../application/too-many-requests.error.js';

export const applicationErrorStatuses: Record<ApplicationErrorKindType, HttpStatus> = {
  notFound: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  invalidInput: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  tooManyRequests: HttpStatus.TOO_MANY_REQUESTS,
};

@Catch(ApplicationError)
export class ApplicationErrorFilter implements ExceptionFilter<ApplicationError> {
  catch(exception: ApplicationError, host: ArgumentsHost): void {
    const status = applicationErrorStatuses[exception.kind];
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof TooManyRequestsError) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }

    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
