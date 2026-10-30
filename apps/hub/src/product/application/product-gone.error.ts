import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

/** The last tracker removed the product while another user was joining it. */
export class ProductGoneError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'conflict';

  constructor(productId: string) {
    super(`Product ${productId} was removed while it was being tracked`);
  }
}
