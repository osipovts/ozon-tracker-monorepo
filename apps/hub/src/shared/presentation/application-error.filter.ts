import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../application/application.error.js';

export const applicationErrorStatuses: Record<ApplicationErrorKindType, HttpStatus> = {
  notFound: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  invalidInput: HttpStatus.BAD_REQUEST,
};

@Catch(ApplicationError)
export class ApplicationErrorFilter implements ExceptionFilter<ApplicationError> {
  catch(exception: ApplicationError, host: ArgumentsHost): void {
    const status = applicationErrorStatuses[exception.kind];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: exception.message });
  }
}
