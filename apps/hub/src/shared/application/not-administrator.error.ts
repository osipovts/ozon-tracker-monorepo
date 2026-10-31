import { ApplicationError, type ApplicationErrorKindType } from './application.error.js';

export class NotAdministratorError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'forbidden';

  constructor() {
    super('This is for the administrators of the hub');
  }
}
