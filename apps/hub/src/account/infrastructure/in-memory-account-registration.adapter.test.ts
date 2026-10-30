import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CredentialEntity } from '../domain/credential.entity.js';
import { UserEntity } from '../domain/user.entity.js';
import { InMemoryAccountRegistrationAdapter } from './in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from './in-memory-credential-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from './in-memory-user-repository.adapter.js';

const createdAt = new Date('2026-10-31T10:00:00Z');

function account(id: string, email: string): { user: UserEntity; credential: CredentialEntity } {
  return {
    user: UserEntity.register(id, email, createdAt),
    credential: new CredentialEntity({ userId: id, passwordHash: `hash-of-${id}` }),
  };
}

void test('creates the user with the credential, or neither when the email is taken', async (): Promise<void> => {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const registration = new InMemoryAccountRegistrationAdapter(users, credentials);
  const first = account('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11', 'jane@example.com');
  const twin = account('6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22', 'jane@example.com');

  assert.equal(await registration.registerWithPassword(first.user, first.credential), true);
  assert.equal(await registration.registerWithPassword(twin.user, twin.credential), false);

  assert.equal(await users.findById(first.user.snapshot.id), first.user);
  assert.equal(await credentials.findByUserId(first.user.snapshot.id), first.credential);
  assert.equal(await credentials.findByUserId(twin.user.snapshot.id), null);
});
