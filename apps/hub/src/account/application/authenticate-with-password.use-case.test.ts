import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CredentialEntity } from '../domain/credential.entity.js';
import { UserEntity } from '../domain/user.entity.js';
import { InMemoryCredentialRepositoryAdapter } from '../infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { AuthenticateWithPasswordUseCase } from './authenticate-with-password.use-case.js';
import { InvalidCredentialsError } from './invalid-credentials.error.js';
import type { PasswordHasherPort } from './password-hasher.port.js';

const jane = UserEntity.register(
  '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
  'jane@example.com',
  new Date('2026-10-31T10:00:00Z'),
);
const oauthOnly = UserEntity.register(
  '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22',
  'sam@example.com',
  new Date('2026-10-31T10:00:00Z'),
);

async function setup(): Promise<{
  useCase: AuthenticateWithPasswordUseCase;
  verified: string[];
  users: InMemoryUserRepositoryAdapter;
  credentials: InMemoryCredentialRepositoryAdapter;
}> {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  await users.add(jane);
  await users.add(oauthOnly);
  await credentials.save(
    new CredentialEntity({ userId: jane.snapshot.id, passwordHash: 'hashed:secret-pass' }),
  );

  const verified: string[] = [];
  const hasher: PasswordHasherPort = {
    hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
    verify: (hash, password): Promise<boolean> => {
      verified.push(hash);

      return Promise.resolve(hash === `hashed:${password}`);
    },
  };

  return {
    useCase: new AuthenticateWithPasswordUseCase(users, credentials, hasher),
    verified,
    users,
    credentials,
  };
}

void test('returns the user of the right password, whatever the case of the email', async (): Promise<void> => {
  const { useCase } = await setup();

  const user = await useCase.execute({ email: ' JANE@example.com', password: 'secret-pass' });

  assert.equal(user.id, jane.snapshot.id);
});

void test('refuses a wrong password', async (): Promise<void> => {
  const { useCase } = await setup();

  await assert.rejects(
    useCase.execute({ email: 'jane@example.com', password: 'wrong-pass' }),
    InvalidCredentialsError,
  );
});

void test('refuses an unknown email and a user without a password the same way, after the same work', async (): Promise<void> => {
  const { useCase, verified } = await setup();

  await assert.rejects(
    useCase.execute({ email: 'nobody@example.com', password: 'secret-pass' }),
    InvalidCredentialsError,
  );
  await assert.rejects(
    useCase.execute({ email: 'sam@example.com', password: 'secret-pass' }),
    InvalidCredentialsError,
  );

  // One hash check each, against a decoy, so that the time does not tell who is registered.
  assert.equal(verified.length, 2);
  assert.ok(!verified.includes('hashed:secret-pass'));
});

void test('a user without a password is refused even where the check of a hash would approve anything', async (): Promise<void> => {
  const { users, credentials } = await setup();
  const approvesAll: PasswordHasherPort = {
    hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
    verify: (): Promise<boolean> => Promise.resolve(true),
  };

  await assert.rejects(
    new AuthenticateWithPasswordUseCase(users, credentials, approvesAll).execute({
      email: 'sam@example.com',
      password: 'anything',
    }),
    InvalidCredentialsError,
  );
});
