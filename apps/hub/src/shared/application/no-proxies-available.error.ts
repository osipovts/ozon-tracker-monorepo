import {
  ApplicationError,
  type ApplicationErrorKindType,
} from './application.error.js';

export class NoProxiesAvailableError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'conflict';

  constructor() {
    super('No alive proxies are available; refresh the proxies first');
  }
}
