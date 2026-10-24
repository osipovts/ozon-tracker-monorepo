import { ApplicationError, type ApplicationErrorKindType } from './application.error.js';

export class JobNotFoundError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'notFound';

  constructor(jobId: string) {
    super(`Job ${jobId} is unknown`);
  }
}
