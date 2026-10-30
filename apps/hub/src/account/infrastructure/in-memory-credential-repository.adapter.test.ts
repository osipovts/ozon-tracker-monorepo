import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CredentialEntity } from '../domain/credential.entity.js';
import { InMemoryCredentialRepositoryAdapter } from './in-memory-credential-repository.adapter.js';

const userId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';

void test('keeps one credential per user: a new one replaces the old', async (): Promise<void> => {
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const changed = new CredentialEntity({ userId, passwordHash: 'new' });

  assert.equal(await credentials.findByUserId(userId), null);

  await credentials.save(new CredentialEntity({ userId, passwordHash: 'old' }));
  await credentials.save(changed);

  assert.equal(await credentials.findByUserId(userId), changed);
});
