import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

/** The link is the last way the user can log in: without it they would lose the account. */
export class LastLoginMethodError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'conflict';

  constructor() {
    super('This is the only way to log in to the account: delete the account instead');
  }
}
