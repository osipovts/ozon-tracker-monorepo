import { ApplicationError, type ApplicationErrorKindType } from '../shared/application.error.js';

export class UnsupportedProductUrlError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'invalidInput';

  constructor() {
    super('Unsupported marketplace or product URL');
  }
}
