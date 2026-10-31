import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class ProductQuotaExceededError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'forbidden';

  constructor(maxProducts: number) {
    super(`You track ${String(maxProducts)} products already, which is the most the hub allows`);
  }
}
