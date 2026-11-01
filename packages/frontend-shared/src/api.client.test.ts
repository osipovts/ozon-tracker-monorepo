import { expect, test } from 'vitest';

import { ensure } from './api.client.js';
import { ApiError } from './api-error.error.js';

function failure(
  status: number,
  error: unknown,
  headers: HeadersInit = {},
): Parameters<typeof ensure>[0] {
  return { error, response: new Response(null, { status, headers }) };
}

test('gives the data of an answer that is ok', (): void => {
  expect(ensure({ data: { id: 1 }, response: new Response(null, { status: 200 }) })).toEqual({
    id: 1,
  });
});

test('gives nothing for an answer without a body', (): void => {
  expect(ensure({ response: new Response(null, { status: 204 }) })).toBeUndefined();
});

test('throws the words of the hub with the status', (): void => {
  expect(() => ensure(failure(409, { statusCode: 409, message: 'Taken' }))).toThrow(
    new ApiError(409, 'Taken', null),
  );
});

test('says the status when the hub gave no words', (): void => {
  expect(() => ensure(failure(502, 'bad gateway'))).toThrow('The hub answered HTTP 502');
});

test('says the status when the words of the hub are not text', (): void => {
  expect(() => ensure(failure(500, { message: 42 }))).toThrow('The hub answered HTTP 500');
});

test.each([
  ['30', 30],
  ['1', 1],
  ['0', null],
  ['soon', null],
])('reads Retry-After %s as %s seconds', (header, seconds): void => {
  const attempt = (): unknown => ensure(failure(429, {}, { 'retry-after': header }));

  expect(attempt).toThrow(expect.objectContaining({ status: 429, retryAfterSeconds: seconds }));
});
