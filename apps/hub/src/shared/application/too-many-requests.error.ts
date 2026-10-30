import { ApplicationError, type ApplicationErrorKindType } from './application.error.js';

export class TooManyRequestsError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'tooManyRequests';
  readonly retryAfterSeconds: number;

  constructor(retryAfterMs: number) {
    super('Too many attempts: try again later');
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  }
}
