import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

import { ApplicationError } from '../../application/shared/application.error.js';
import { LOGGER, type LoggerPort } from '../../application/shared/logger.port.js';
import { applicationErrorStatuses } from './application-error.filter.js';

/** Logs every request: the method, the path, the status and the duration. */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(@Inject(LOGGER) private readonly logger: LoggerPort) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = performance.now();
    const label = `${request.method} ${request.originalUrl}`;
    this.logger.verbose(`--> ${label}`);
    const done = (status: number, error?: unknown): void => {
      const line = `<-- ${label} ${String(status)} ${String(Math.round(performance.now() - startedAt))} ms`;
      if (status >= 500)
        this.logger.error(`${line}: ${error instanceof Error ? error.message : 'unknown error'}`);
      else if (status >= 400) this.logger.warn(line);
      else this.logger.verbose(line);
    };
    return next.handle().pipe(
      tap({
        complete: (): void => {
          done(response.statusCode);
        },
        error: (error: unknown): void => {
          done(this.statusOf(error), error);
        },
      }),
    );
  }

  private statusOf(error: unknown): number {
    if (error instanceof HttpException) return error.getStatus();
    if (error instanceof ApplicationError) return applicationErrorStatuses[error.kind];
    return 500;
  }
}
