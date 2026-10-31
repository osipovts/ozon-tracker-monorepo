import createClient from 'openapi-fetch';

import { ApiError } from './api-error.error.js';
import type { paths } from './schema.js';

/** The hub, from the origin the panel was served from; the session cookie goes along. */
export const api = createClient<paths>({
  baseUrl: window.location.origin,
  credentials: 'same-origin',
  // Looked up on every call, so that a test can stand in for the network.
  fetch: (request: Request): Promise<Response> => globalThis.fetch(request),
});

interface ResultInterface<Data> {
  data?: Data;
  error?: unknown;
  response: Response;
}

/** The message of an error body of the hub, which is `{ statusCode, message }`. */
function messageOf(error: unknown, fallback: string): string {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : fallback;
}

/** The data of a result that is ok (none for a 204), or the `ApiError` of one that is not. */
export function ensure<Data>(result: ResultInterface<Data>): Data | undefined {
  if (result.response.ok) return result.data;

  const retryAfter = Number(result.response.headers.get('retry-after'));

  throw new ApiError(
    result.response.status,
    messageOf(result.error, `The hub answered HTTP ${String(result.response.status)}`),
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  );
}
