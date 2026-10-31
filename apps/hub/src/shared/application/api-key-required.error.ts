import { ApplicationError, type ApplicationErrorKindType } from './application.error.js';

export class ApiKeyRequiredError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'unauthorized';

  constructor() {
    super('A valid API key is required');
  }
}
