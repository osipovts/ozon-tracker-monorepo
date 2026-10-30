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
import { TooManyRequestsError } from '../../shared/application/too-many-requests.error.js';
import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import { LogInUseCase } from './log-in.use-case.js';

const hasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};
const policy = { idleTtlMs: 60_000, absoluteTtlMs: 120_000 };
const limits = {
  perEmailAndIp: { limit: 3, windowMs: 60_000 },
  perEmail: { limit: 6, windowMs: 60_000 },
  perIp: { limit: 5, windowMs: 60_000 },
};

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
      new InMemoryRateLimiterAdapter(),
      limits,
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

const attempt = (
  email: string,
  ip: string | null,
  password = 'secret-pass',
): { email: string; password: string; userAgent: null; ip: string | null } => ({
  email,
  password,
  userAgent: null,
  ip,
});

void test('stops an address that tries one email too often, even with the right password', async (): Promise<void> => {
  const { logIn } = await setup();

  for (let tries = 0; tries < 3; tries += 1) {
    await assert.rejects(
      logIn.execute(attempt('jane@example.com', '203.0.113.7', 'wrong-pass')),
      InvalidCredentialsError,
    );
  }

  await assert.rejects(
    logIn.execute(attempt('JANE@example.com', '203.0.113.7')),
    TooManyRequestsError,
  );
});

void test('does not let a stranger lock the owner out: the guesses of one address are not counted against the others', async (): Promise<void> => {
  const { logIn } = await setup();
  for (let tries = 0; tries < 3; tries += 1) {
    await assert.rejects(
      logIn.execute(attempt('jane@example.com', '198.51.100.9', 'wrong-pass')),
      InvalidCredentialsError,
    );
  }

  assert.equal(
    (await logIn.execute(attempt('jane@example.com', '203.0.113.7'))).user.email,
    'jane@example.com',
  );
});

void test('still stops guessing of one email that is spread over many addresses', async (): Promise<void> => {
  const { logIn } = await setup();
  for (let address = 1; address <= 6; address += 1) {
    await assert.rejects(
      logIn.execute(attempt('jane@example.com', `198.51.100.${String(address)}`, 'wrong-pass')),
      InvalidCredentialsError,
    );
  }

  await assert.rejects(
    logIn.execute(attempt('jane@example.com', '198.51.100.99')),
    TooManyRequestsError,
  );
});

void test('stops an address that tries too many emails, and leaves the others alone', async (): Promise<void> => {
  const { logIn } = await setup();

  for (let tries = 0; tries < 5; tries += 1) {
    await assert.rejects(
      logIn.execute(attempt(`nobody-${String(tries)}@example.com`, '203.0.113.7')),
      InvalidCredentialsError,
    );
  }

  await assert.rejects(
    logIn.execute(attempt('jane@example.com', '203.0.113.7')),
    TooManyRequestsError,
  );
  assert.equal(
    (await logIn.execute(attempt('jane@example.com', '198.51.100.9'))).user.email,
    'jane@example.com',
  );
});

void test('names how long to wait', async (): Promise<void> => {
  const { logIn } = await setup();
  for (let tries = 0; tries < 6; tries += 1) await logIn.execute(attempt('jane@example.com', null));

  await assert.rejects(
    logIn.execute(attempt('jane@example.com', null)),
    (error: unknown): boolean => {
      assert.ok(error instanceof TooManyRequestsError);
      assert.ok(error.retryAfterSeconds >= 1 && error.retryAfterSeconds <= 60);

      return true;
    },
  );
});
