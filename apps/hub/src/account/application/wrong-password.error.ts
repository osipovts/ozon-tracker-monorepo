import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

/** Not a 401: the user is signed in, it is the password they gave to prove it again that is wrong. */
export class WrongPasswordError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'invalidInput';

  constructor() {
    super('The current password is wrong');
  }
}
