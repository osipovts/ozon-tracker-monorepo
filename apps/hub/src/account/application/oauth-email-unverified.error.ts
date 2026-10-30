import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class OauthEmailUnverifiedError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'unauthorized';

  constructor() {
    super('The provider does not vouch for the email of this account');
  }
}
