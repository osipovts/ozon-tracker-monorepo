import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthenticateWithPasswordUseCase } from '../../account/application/authenticate-with-password.use-case.js';
import { InvalidCredentialsError } from '../../account/application/invalid-credentials.error.js';
import type { PasswordHasherPort } from '../../account/application/password-hasher.port.js';
import { RegisterAccountUseCase } from '../../account/application/register-account.use-case.js';
import { InMemoryAccountRegistrationAdapter } from '../../account/infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../../account/infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../../account/infrastructure/in-memory-user-repository.adapter.js';
import { ResolveAuthSessionUseCase } from '../../auth-session/application/resolve-auth-session.use-case.js';
import { StartAuthSessionUseCase } from '../../auth-session/application/start-auth-session.use-case.js';
import { InMemoryAuthSessionRepositoryAdapter } from '../../auth-session/infrastructure/in-memory-auth-session-repository.adapter.js';
import { LogInUseCase } from './log-in.use-case.js';

const hasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};
const policy = { idleTtlMs: 60_000, absoluteTtlMs: 120_000 };

async function setup(): Promise<{
  logIn: LogInUseCase;
  resolve: ResolveAuthSessionUseCase;
  userId: string;
}> {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const registered = await new RegisterAccountUseCase(
    new InMemoryAccountRegistrationAdapter(users, credentials),
    hasher,
  ).execute({ email: 'jane@example.com', password: 'secret-pass' });

  return {
    logIn: new LogInUseCase(
      new AuthenticateWithPasswordUseCase(users, credentials, hasher),
      new StartAuthSessionUseCase(sessions, policy),
    ),
    resolve: new ResolveAuthSessionUseCase(sessions, policy),
    userId: registered.id,
  };
}

void test('logs the user in with a new session on every login', async (): Promise<void> => {
  const { logIn, resolve, userId } = await setup();
  const input = {
    email: 'JANE@example.com',
    password: 'secret-pass',
    userAgent: 'Mozilla/5.0',
    ip: '203.0.113.7',
  };

  const first = await logIn.execute(input);
  const second = await logIn.execute(input);

  assert.equal(first.user.id, userId);
  assert.notEqual(first.token, second.token);
  assert.equal((await resolve.execute(first.token))?.userId, userId);
  assert.equal((await resolve.execute(second.token))?.userId, userId);
});

void test('starts no session for a wrong password', async (): Promise<void> => {
  const { logIn } = await setup();

  await assert.rejects(
    logIn.execute({ email: 'jane@example.com', password: 'wrong', userAgent: null, ip: null }),
    InvalidCredentialsError,
  );
});
