import type { TFunction } from 'i18next';

import { ApiError } from './api-error.error.js';

/** What the person is told of a refusal: the hub's own words say too little of a wrong login. */
export function explainLoginRefusal(error: Error, t: TFunction): string {
  if (!(error instanceof ApiError)) return t('errors.unreachable');
  if (error.status === 401) return t('login.wrongCredentials');
  if (error.status === 429) {
    const wait =
      error.retryAfterSeconds === null
        ? ''
        : ` ${t('errors.tryAgain', { seconds: error.retryAfterSeconds })}`;

    return `${t('login.tooManyAttempts')}${wait}`;
  }

  return error.message;
}
