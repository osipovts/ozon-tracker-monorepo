import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class InvalidVerificationTokenError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'invalidInput';

  constructor() {
    super('The link is wrong or has expired: ask for a new one');
  }
}
