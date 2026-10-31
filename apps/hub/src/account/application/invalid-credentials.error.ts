import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

/** The answer does not tell an unknown email from a wrong password. */
export class InvalidCredentialsError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'unauthorized';

  constructor() {
    super('The email or the password is wrong');
  }
}
