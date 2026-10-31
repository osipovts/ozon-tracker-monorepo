import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class EmailTakenError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'conflict';

  constructor(email: string) {
    super(`The email ${email} is registered already`);
  }
}
