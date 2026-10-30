import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class NotSignedInError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'unauthorized';

  constructor() {
    super('Sign in first');
  }
}
