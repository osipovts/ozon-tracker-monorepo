import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EmailTakenError } from '../../account/application/email-taken.error.js';
import type { PasswordHasherPort } from '../../account/application/password-hasher.port.js';
import { RegisterAccountUseCase } from '../../account/application/register-account.use-case.js';
import { InMemoryAccountRegistrationAdapter } from '../../account/infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../../account/infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../../account/infrastructure/in-memory-user-repository.adapter.js';
import { ResolveAuthSessionUseCase } from '../../auth-session/application/resolve-auth-session.use-case.js';
import { StartAuthSessionUseCase } from '../../auth-session/application/start-auth-session.use-case.js';
import { InMemoryAuthSessionRepositoryAdapter } from '../../auth-session/infrastructure/in-memory-auth-session-repository.adapter.js';
import { SignUpUseCase } from './sign-up.use-case.js';

const hasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};
const policy = { idleTtlMs: 60_000, absoluteTtlMs: 120_000 };

function setup(): { signUp: SignUpUseCase; resolve: ResolveAuthSessionUseCase } {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const sessions = new InMemoryAuthSessionRepositoryAdapter();

  return {
    signUp: new SignUpUseCase(
      new RegisterAccountUseCase(
        new InMemoryAccountRegistrationAdapter(users, credentials),
        hasher,
      ),
      new StartAuthSessionUseCase(sessions, policy),
    ),
    resolve: new ResolveAuthSessionUseCase(sessions, policy),
  };
}

void test('signs the user up and logs them in with a session of their own', async (): Promise<void> => {
  const { signUp, resolve } = setup();

  const result = await signUp.execute({
    email: 'Jane@Example.com',
    password: 'secret-pass',
    userAgent: 'Mozilla/5.0',
    ip: '203.0.113.7',
  });

  assert.equal(result.user.email, 'jane@example.com');
  assert.equal((await resolve.execute(result.token))?.userId, result.user.id);
});

void test('refuses a registered email', async (): Promise<void> => {
  const { signUp } = setup();
  const input = { email: 'jane@example.com', password: 'secret-pass', userAgent: null, ip: null };
  await signUp.execute(input);

  await assert.rejects(signUp.execute(input), EmailTakenError);
});
