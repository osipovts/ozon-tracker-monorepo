import { ApplicationError, type ApplicationErrorKindType } from './application.error.js';

export class ForeignOriginError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'forbidden';

  constructor() {
    super('The request comes from an origin this hub does not serve');
  }
}
