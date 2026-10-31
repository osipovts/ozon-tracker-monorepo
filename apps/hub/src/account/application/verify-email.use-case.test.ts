import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClockPort } from '../../shared/application/clock.port.js';
import { InMemoryMailerAdapter } from '../../shared/infrastructure/in-memory-mailer.adapter.js';
import { UserEntity } from '../domain/user.entity.js';
import { InMemoryEmailVerificationRepositoryAdapter } from '../infrastructure/in-memory-email-verification-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { InvalidVerificationTokenError } from './invalid-verification-token.error.js';
import { SendEmailVerificationUseCase } from './send-email-verification.use-case.js';
import { VerifyEmailUseCase } from './verify-email.use-case.js';

const minute = 60_000;
const start = new Date('2026-10-31T10:00:00Z');
const jane = UserEntity.register('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11', 'jane@example.com', start);

async function setup(): Promise<{
  verify: VerifyEmailUseCase;
  token: string;
  users: InMemoryUserRepositoryAdapter;
  at: (minutes: number) => void;
}> {
  let current = start;
  const clock: ClockPort = { now: (): Date => current };
  const users = new InMemoryUserRepositoryAdapter();
  await users.add(jane);
  const mailer = new InMemoryMailerAdapter();
  const verifications = new InMemoryEmailVerificationRepositoryAdapter();
  await new SendEmailVerificationUseCase(
    users,
    verifications,
    mailer,
    { linkBase: 'https://hub.example.com', ttlMs: 60 * minute },
    clock,
  ).execute(jane.snapshot.id);
  const token = /token=([A-Za-z0-9_-]+)/.exec(mailer.sent[0]?.text ?? '')?.[1];
  assert.ok(token !== undefined);

  return {
    verify: new VerifyEmailUseCase(users, verifications, clock),
    token,
    users,
    at: (minutes): void => {
      current = new Date(start.getTime() + minutes * minute);
    },
  };
}

void test('proves the email of the user whose mailbox the link came to', async (): Promise<void> => {
  const { verify, token, users, at } = await setup();
  at(5);

  const user = await verify.execute(token);

  assert.equal(user.id, jane.snapshot.id);
  assert.deepEqual(user.emailVerifiedAt, new Date(start.getTime() + 5 * minute));
  assert.notEqual((await users.findById(jane.snapshot.id))?.snapshot.emailVerifiedAt, null);
});

void test('opening the link again is harmless: a mail scanner that opened it first does not spoil it for the user', async (): Promise<void> => {
  const { verify, token, at } = await setup();
  at(1);
  const first = await verify.execute(token);
  at(30);

  const again = await verify.execute(token);

  assert.deepEqual(again.emailVerifiedAt, first.emailVerifiedAt);
});

void test('refuses a link that is unknown or has expired', async (): Promise<void> => {
  const { verify, token, at } = await setup();

  await assert.rejects(verify.execute('not-a-token'), InvalidVerificationTokenError);

  at(61);
  await assert.rejects(verify.execute(token), InvalidVerificationTokenError);
});
