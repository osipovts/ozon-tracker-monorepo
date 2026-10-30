import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryAccountRegistrationAdapter } from '../infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { EmailTakenError } from './email-taken.error.js';
import type { PasswordHasherPort } from './password-hasher.port.js';
import { RegisterAccountUseCase } from './register-account.use-case.js';

const hasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};

function setup(): {
  useCase: RegisterAccountUseCase;
  users: InMemoryUserRepositoryAdapter;
  credentials: InMemoryCredentialRepositoryAdapter;
} {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const registration = new InMemoryAccountRegistrationAdapter(users, credentials);

  return { useCase: new RegisterAccountUseCase(registration, hasher), users, credentials };
}

void test('registers a user by the normalized email and keeps only the hash of the password', async (): Promise<void> => {
  const { useCase, users, credentials } = setup();

  const user = await useCase.execute({ email: ' Jane@Example.com ', password: 'secret-pass' });

  assert.equal(user.email, 'jane@example.com');
  assert.equal(user.emailVerifiedAt, null);
  assert.equal((await users.findById(user.id))?.snapshot.email, 'jane@example.com');
  assert.equal(
    (await credentials.findByUserId(user.id))?.snapshot.passwordHash,
    'hashed:secret-pass',
  );
});

void test('refuses a registered email whatever its case and keeps the first password', async (): Promise<void> => {
  const { useCase, credentials } = setup();
  const first = await useCase.execute({ email: 'jane@example.com', password: 'first-pass' });

  await assert.rejects(
    useCase.execute({ email: 'JANE@example.com', password: 'second-pass' }),
    EmailTakenError,
  );

  assert.equal(
    (await credentials.findByUserId(first.id))?.snapshot.passwordHash,
    'hashed:first-pass',
  );
});
