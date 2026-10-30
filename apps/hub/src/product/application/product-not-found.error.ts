import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class ProductNotFoundError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'notFound';

  constructor(productId: string) {
    super(`Product ${productId} is not tracked`);
  }
}
