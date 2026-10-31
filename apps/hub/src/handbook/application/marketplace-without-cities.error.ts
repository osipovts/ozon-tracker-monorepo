import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class MarketplaceWithoutCitiesError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'notFound';

  constructor(marketplace: string) {
    super(`The prices of ${marketplace} do not depend on the city`);
  }
}
