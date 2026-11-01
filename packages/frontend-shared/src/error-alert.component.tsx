import { Alert } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from './api-error.error.js';

/** Says what went wrong with a request, in the words of the hub; asked to wait, it says for how long. */
export function ErrorAlert({ error }: { error: unknown }): ReactElement {
  const { t } = useTranslation();
  const wait =
    error instanceof ApiError && error.retryAfterSeconds !== null
      ? ` ${t('errors.tryAgain', { seconds: error.retryAfterSeconds })}`
      : '';

  return (
    <Alert color="red" title={t('errors.title')} role="alert">
      {error instanceof ApiError ? error.message : t('errors.unreachable')}
      {wait}
    </Alert>
  );
}
