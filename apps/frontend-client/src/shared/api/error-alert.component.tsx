import { Alert } from '@mantine/core';
import type { ReactElement } from 'react';

import { ApiError } from './api-error.error.js';

/** Says what went wrong with a request, in the words of the hub; asked to wait, it says for how long. */
export function ErrorAlert({ error }: { error: unknown }): ReactElement {
  const wait =
    error instanceof ApiError && error.retryAfterSeconds !== null
      ? ` Try again in ${String(error.retryAfterSeconds)} s.`
      : '';

  return (
    <Alert color="red" title="Something went wrong" role="alert">
      {error instanceof Error ? error.message : 'The request failed.'}
      {wait}
    </Alert>
  );
}
