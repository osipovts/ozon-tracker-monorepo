import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class OauthProviderNotConfiguredError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'notFound';

  constructor(provider: string) {
    super(`The login through ${provider} is not set up`);
  }
}
