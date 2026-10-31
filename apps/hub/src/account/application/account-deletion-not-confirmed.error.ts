import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class AccountDeletionNotConfirmedError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'invalidInput';

  constructor() {
    super('The email given does not match the one of the account');
  }
}
