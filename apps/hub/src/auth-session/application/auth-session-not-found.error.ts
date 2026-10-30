import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class AuthSessionNotFoundError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'notFound';

  constructor(sessionId: string) {
    super(`Session ${sessionId} is unknown`);
  }
}
