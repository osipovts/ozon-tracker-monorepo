import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hashSecretToken, issueSecretToken } from './secret-token.type.js';

void test('issues tokens of 256 random bits, each its own', (): void => {
  const first = issueSecretToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, issueSecretToken());
});

void test('keeps a hash instead of the token: the same token the same hash, and not the token', (): void => {
  const token = issueSecretToken();

  assert.equal(hashSecretToken(token), hashSecretToken(token));
  assert.match(hashSecretToken(token), /^[0-9a-f]{64}$/);
  assert.notEqual(hashSecretToken(token), token);
  assert.notEqual(hashSecretToken(token), hashSecretToken(issueSecretToken()));
});
