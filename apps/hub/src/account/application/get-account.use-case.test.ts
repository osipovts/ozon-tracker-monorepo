import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UserEntity } from '../domain/user.entity.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { GetAccountUseCase } from './get-account.use-case.js';

void test('gives the user of an id, and nothing for an unknown one', async (): Promise<void> => {
  const users = new InMemoryUserRepositoryAdapter();
  const jane = UserEntity.register(
    '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
    'jane@example.com',
    new Date('2026-10-31T10:00:00Z'),
  );
  await users.add(jane);
  const get = new GetAccountUseCase(users);

  assert.deepEqual(await get.execute(jane.snapshot.id), jane.snapshot);
  assert.equal(await get.execute('9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33'), null);
});
