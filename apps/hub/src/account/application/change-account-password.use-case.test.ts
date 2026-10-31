import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CredentialEntity } from '../domain/credential.entity.js';
import { UserEntity } from '../domain/user.entity.js';
import { InMemoryCredentialRepositoryAdapter } from '../infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { AuthenticateWithPasswordUseCase } from './authenticate-with-password.use-case.js';
import { ChangeAccountPasswordUseCase } from './change-account-password.use-case.js';
import { InvalidCredentialsError } from './invalid-credentials.error.js';
import type { PasswordHasherPort } from './password-hasher.port.js';
import { WrongPasswordError } from './wrong-password.error.js';

const hasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};
const at = new Date('2026-10-31T10:00:00Z');
const jane = UserEntity.register('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11', 'jane@example.com', at);
const oauthOnly = UserEntity.register(
  '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22',
  'sam@example.com',
  at,
);

async function setup(): Promise<{
  change: ChangeAccountPasswordUseCase;
  authenticate: AuthenticateWithPasswordUseCase;
  credentials: InMemoryCredentialRepositoryAdapter;
}> {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  await users.add(jane);
  await users.add(oauthOnly);
  await credentials.save(
    new CredentialEntity({ userId: jane.snapshot.id, passwordHash: 'hashed:old-password' }),
  );

  return {
    change: new ChangeAccountPasswordUseCase(credentials, hasher),
    authenticate: new AuthenticateWithPasswordUseCase(users, credentials, hasher),
    credentials,
  };
}

void test('sets the new password once the current one is proven, and the old one stops working', async (): Promise<void> => {
  const { change, authenticate, credentials } = await setup();

  await change.execute({
    userId: jane.snapshot.id,
    currentPassword: 'old-password',
    newPassword: 'new-password',
  });

  assert.equal(
    (await authenticate.execute({ email: 'jane@example.com', password: 'new-password' })).id,
    jane.snapshot.id,
  );
  await assert.rejects(
    authenticate.execute({ email: 'jane@example.com', password: 'old-password' }),
    InvalidCredentialsError,
  );
  assert.equal(
    (await credentials.findByUserId(jane.snapshot.id))?.snapshot.passwordHash,
    'hashed:new-password',
  );
});

void test('keeps the password when the current one is wrong', async (): Promise<void> => {
  const { change, credentials } = await setup();

  await assert.rejects(
    change.execute({
      userId: jane.snapshot.id,
      currentPassword: 'guess',
      newPassword: 'new-password',
    }),
    WrongPasswordError,
  );

  assert.equal(
    (await credentials.findByUserId(jane.snapshot.id))?.snapshot.passwordHash,
    'hashed:old-password',
  );
});

void test('has no password to change for a user who signs in through a provider only', async (): Promise<void> => {
  const { change } = await setup();

  await assert.rejects(
    change.execute({
      userId: oauthOnly.snapshot.id,
      currentPassword: 'anything',
      newPassword: 'new-password',
    }),
    WrongPasswordError,
  );
});
