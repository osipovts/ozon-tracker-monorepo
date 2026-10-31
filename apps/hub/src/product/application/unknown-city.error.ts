import {
  ApplicationError,
  type ApplicationErrorKindType,
} from '../../shared/application/application.error.js';

export class UnknownCityError extends ApplicationError {
  readonly kind: ApplicationErrorKindType = 'invalidInput';

  constructor(readonly cityId: string) {
    super(`The marketplace has no city ${cityId}`);
  }
}
