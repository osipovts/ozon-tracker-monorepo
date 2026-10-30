import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ChangeAccountPasswordUseCase } from '../../account/application/change-account-password.use-case.js';
import type { PasswordHasherPort } from '../../account/application/password-hasher.port.js';
import { RegisterAccountUseCase } from '../../account/application/register-account.use-case.js';
import { WrongPasswordError } from '../../account/application/wrong-password.error.js';
import { InMemoryAccountRegistrationAdapter } from '../../account/infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../../account/infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../../account/infrastructure/in-memory-user-repository.adapter.js';
import { ResolveAuthSessionUseCase } from '../../auth-session/application/resolve-auth-session.use-case.js';
import { RevokeOtherAuthSessionsUseCase } from '../../auth-session/application/revoke-other-auth-sessions.use-case.js';
import { StartAuthSessionUseCase } from '../../auth-session/application/start-auth-session.use-case.js';
import { InMemoryAuthSessionRepositoryAdapter } from '../../auth-session/infrastructure/in-memory-auth-session-repository.adapter.js';
import { TooManyRequestsError } from '../../shared/application/too-many-requests.error.js';
import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import { ChangePasswordUseCase } from './change-password.use-case.js';

const hasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};
const policy = { idleTtlMs: 60_000, absoluteTtlMs: 120_000 };

async function setup(): Promise<{
  change: ChangePasswordUseCase;
  userId: string;
  tokens: string[];
  currentSessionId: string;
  resolve: ResolveAuthSessionUseCase;
}> {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const user = await new RegisterAccountUseCase(
    new InMemoryAccountRegistrationAdapter(users, credentials),
    hasher,
  ).execute({ email: 'jane@example.com', password: 'old-password' });
  const start = new StartAuthSessionUseCase(sessions, policy);
  const resolve = new ResolveAuthSessionUseCase(sessions, policy);
  const tokens: string[] = [];
  for (let device = 0; device < 3; device += 1) {
    tokens.push((await start.execute({ userId: user.id, userAgent: null, ip: null })).token);
  }

  return {
    change: new ChangePasswordUseCase(
      new ChangeAccountPasswordUseCase(credentials, hasher),
      new RevokeOtherAuthSessionsUseCase(sessions),
      new InMemoryRateLimiterAdapter(),
      { limit: 3, windowMs: 60_000 },
    ),
    userId: user.id,
    tokens,
    currentSessionId: (await resolve.execute(tokens[0] ?? ''))?.sessionId ?? '',
    resolve,
  };
}

void test('changes the password and signs the user out of every other device, but not this one', async (): Promise<void> => {
  const { change, userId, tokens, currentSessionId, resolve } = await setup();

  const { revokedSessions } = await change.execute({
    userId,
    sessionId: currentSessionId,
    currentPassword: 'old-password',
    newPassword: 'new-password',
  });

  assert.equal(revokedSessions, 2);
  assert.notEqual(await resolve.execute(tokens[0] ?? ''), null);
  assert.equal(await resolve.execute(tokens[1] ?? ''), null);
  assert.equal(await resolve.execute(tokens[2] ?? ''), null);
});

void test('signs nobody out when the current password is wrong', async (): Promise<void> => {
  const { change, userId, tokens, currentSessionId, resolve } = await setup();

  await assert.rejects(
    change.execute({
      userId,
      sessionId: currentSessionId,
      currentPassword: 'guess',
      newPassword: 'new-password',
    }),
    WrongPasswordError,
  );

  assert.notEqual(await resolve.execute(tokens[1] ?? ''), null);
});

void test('stops guessing of the current password through a stolen session', async (): Promise<void> => {
  const { change, userId, currentSessionId } = await setup();
  const guess = {
    userId,
    sessionId: currentSessionId,
    currentPassword: 'guess',
    newPassword: 'new-password',
  };

  for (let tries = 0; tries < 3; tries += 1) {
    await assert.rejects(change.execute(guess), WrongPasswordError);
  }

  await assert.rejects(
    change.execute({ ...guess, currentPassword: 'old-password' }),
    TooManyRequestsError,
  );
});
