import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UserEntity } from '../domain/user.entity.js';
import { InMemoryUserRepositoryAdapter } from './in-memory-user-repository.adapter.js';

const createdAt = new Date('2026-10-31T10:00:00Z');
const jane = UserEntity.register(
  '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
  'jane@example.com',
  createdAt,
);

void test('adds a user once per email, whatever the case of the address', async (): Promise<void> => {
  const users = new InMemoryUserRepositoryAdapter();
  const twin = UserEntity.register(
    '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22',
    'JANE@example.com',
    createdAt,
  );

  assert.equal(await users.add(jane), true);
  assert.equal(await users.add(twin), false);
  assert.equal(await users.findById(twin.snapshot.id), null);
});

void test('finds a user by id and by the normalized email', async (): Promise<void> => {
  const users = new InMemoryUserRepositoryAdapter();
  await users.add(jane);

  assert.equal(await users.findById(jane.snapshot.id), jane);
  assert.equal(await users.findByEmail(UserEntity.normalizeEmail(' Jane@Example.com ')), jane);
  assert.equal(await users.findByEmail('nobody@example.com'), null);
});
