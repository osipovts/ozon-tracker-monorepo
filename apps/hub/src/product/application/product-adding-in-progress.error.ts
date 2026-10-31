import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class ProductAddingInProgressError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'conflict';

  constructor() {
    super('Another product of yours is still being added; wait for it to finish');
  }
}
