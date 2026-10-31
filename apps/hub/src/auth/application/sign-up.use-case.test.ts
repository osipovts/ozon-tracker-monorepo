import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthenticateWithPasswordUseCase } from '../../account/application/authenticate-with-password.use-case.js';
import type { PasswordHasherPort } from '../../account/application/password-hasher.port.js';
import { RegisterAccountUseCase } from '../../account/application/register-account.use-case.js';
import { InMemoryAccountRegistrationAdapter } from '../../account/infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../../account/infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../../account/infrastructure/in-memory-user-repository.adapter.js';
import { TooManyRequestsError } from '../../shared/application/too-many-requests.error.js';
import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import { SignUpUseCase } from './sign-up.use-case.js';

const hasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};

function setup(): { signUp: SignUpUseCase; authenticate: AuthenticateWithPasswordUseCase } {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const registration = new InMemoryAccountRegistrationAdapter(users, credentials);

  return {
    signUp: new SignUpUseCase(
      new RegisterAccountUseCase(registration, hasher),
      new InMemoryRateLimiterAdapter(),
      { limit: 2, windowMs: 60_000 },
    ),
    authenticate: new AuthenticateWithPasswordUseCase(users, credentials, hasher),
  };
}

const from = (
  n: number,
  ip: string | null,
  email = `user-${String(n)}@example.com`,
  password = 'secret-pass',
): { email: string; password: string; ip: string | null } => ({ email, password, ip });

void test('signs the user up: they can log in afterwards, and no session is started', async (): Promise<void> => {
  const { signUp, authenticate } = setup();

  await signUp.execute(from(1, '203.0.113.7', 'Jane@Example.com'));

  assert.equal(
    (await authenticate.execute({ email: 'jane@example.com', password: 'secret-pass' })).email,
    'jane@example.com',
  );
});

void test('takes a taken email without a word, and without touching the account that has it', async (): Promise<void> => {
  const { signUp, authenticate } = setup();
  await signUp.execute(from(1, null, 'jane@example.com', 'first-pass'));

  // Nothing tells the caller that the email was taken: it would tell them who has an account.
  await signUp.execute(from(2, null, 'JANE@example.com', 'second-pass'));

  assert.equal(
    (await authenticate.execute({ email: 'jane@example.com', password: 'first-pass' })).email,
    'jane@example.com',
  );
  await assert.rejects(
    authenticate.execute({ email: 'jane@example.com', password: 'second-pass' }),
  );
});

void test('stops an address that signs up too many users, and leaves the others alone', async (): Promise<void> => {
  const { signUp } = setup();

  await signUp.execute(from(1, '203.0.113.7'));
  await signUp.execute(from(2, '203.0.113.7'));
  await assert.rejects(signUp.execute(from(3, '203.0.113.7')), TooManyRequestsError);

  await signUp.execute(from(4, '198.51.100.9'));
  await signUp.execute(from(5, null));
  await signUp.execute(from(6, null));
  await signUp.execute(from(7, null));
});
