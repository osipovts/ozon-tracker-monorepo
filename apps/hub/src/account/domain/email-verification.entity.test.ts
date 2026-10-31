import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EmailVerificationEntity } from './email-verification.entity.js';

const hour = 3_600_000;
const issuedAt = new Date('2026-10-31T10:00:00Z');

void test('a link is good until it expires', (): void => {
  const verification = EmailVerificationEntity.issue(
    { id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11', userId: 'user', tokenHash: 'hash' },
    24 * hour,
    issuedAt,
  );

  assert.equal(verification.isValid(new Date(issuedAt.getTime() + 24 * hour - 1)), true);
  assert.equal(verification.isValid(new Date(issuedAt.getTime() + 24 * hour)), false);
  assert.deepEqual(verification.snapshot.createdAt, issuedAt);
});
