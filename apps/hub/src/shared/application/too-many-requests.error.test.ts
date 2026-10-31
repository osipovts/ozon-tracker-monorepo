import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TooManyRequestsError } from './too-many-requests.error.js';

void test('asks to wait whole seconds, rounded up and never none', (): void => {
  assert.equal(new TooManyRequestsError(0).retryAfterSeconds, 1);
  assert.equal(new TooManyRequestsError(400).retryAfterSeconds, 1);
  assert.equal(new TooManyRequestsError(1500).retryAfterSeconds, 2);
  assert.equal(new TooManyRequestsError(60_000).retryAfterSeconds, 60);
});
