import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UserEntity } from './user.entity.js';

const id = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';
const createdAt = new Date('2026-10-31T10:00:00Z');

void test('a user is identified by the trimmed lowercase email and starts unverified', (): void => {
  const user = UserEntity.register(id, '  Jane.Doe@Example.COM ', createdAt);

  assert.deepEqual(user.snapshot, {
    id,
    email: 'jane.doe@example.com',
    emailVerifiedAt: null,
    createdAt,
  });
});
