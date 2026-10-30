import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class OauthLoginFailedError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'unauthorized';

  constructor(reason: string) {
    super(`The login through the provider failed: ${reason}`);
  }
}
