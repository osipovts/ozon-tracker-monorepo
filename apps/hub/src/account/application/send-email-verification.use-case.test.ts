import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hashSecretToken } from '../../shared/application/secret-token.type.js';
import { InMemoryMailerAdapter } from '../../shared/infrastructure/in-memory-mailer.adapter.js';
import { UserEntity } from '../domain/user.entity.js';
import { InMemoryEmailVerificationRepositoryAdapter } from '../infrastructure/in-memory-email-verification-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { SendEmailVerificationUseCase } from './send-email-verification.use-case.js';

const at = new Date('2026-10-31T10:00:00Z');
const jane = UserEntity.register('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11', 'jane@example.com', at);
const ann = UserEntity.registerVerified(
  '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22',
  'ann@example.com',
  at,
);

async function setup(): Promise<{
  send: SendEmailVerificationUseCase;
  mailer: InMemoryMailerAdapter;
  verifications: InMemoryEmailVerificationRepositoryAdapter;
}> {
  const users = new InMemoryUserRepositoryAdapter();
  await users.add(jane);
  await users.add(ann);
  const mailer = new InMemoryMailerAdapter();
  const verifications = new InMemoryEmailVerificationRepositoryAdapter();

  return {
    send: new SendEmailVerificationUseCase(
      users,
      verifications,
      mailer,
      { linkBase: 'https://hub.example.com', ttlMs: 60_000 },
      { now: (): Date => at },
    ),
    mailer,
    verifications,
  };
}

function tokenIn(text: string): string {
  const token = /\/auth\/verify-email\?token=([A-Za-z0-9_-]+)/.exec(text)?.[1];
  assert.ok(token !== undefined, 'no link in the mail');

  return token;
}

void test('mails the user a link to confirm the email, and keeps only the hash of its token', async (): Promise<void> => {
  const { send, mailer, verifications } = await setup();

  assert.equal(await send.execute(jane.snapshot.id), true);

  assert.equal(mailer.sent.length, 1);
  const [mail] = mailer.sent;
  assert.ok(mail);
  assert.equal(mail.to, 'jane@example.com');
  assert.match(mail.text, /https:\/\/hub\.example\.com\/auth\/verify-email\?token=/);
  const token = tokenIn(mail.text);
  const stored = await verifications.findByTokenHash(hashSecretToken(token));
  assert.ok(stored);
  assert.equal(stored.snapshot.userId, jane.snapshot.id);
  assert.equal(await verifications.findByTokenHash(token), null);
  assert.deepEqual(stored.snapshot.expiresAt, new Date(at.getTime() + 60_000));
});

void test('sends nothing for an email that is proven already, or for nobody', async (): Promise<void> => {
  const { send, mailer } = await setup();

  assert.equal(await send.execute(ann.snapshot.id), false);
  assert.equal(await send.execute('9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33'), false);
  assert.equal(mailer.sent.length, 0);
});

void test('a new link replaces the earlier one: only the latest works', async (): Promise<void> => {
  const { send, mailer, verifications } = await setup();
  await send.execute(jane.snapshot.id);
  await send.execute(jane.snapshot.id);

  const [first, second] = mailer.sent.map((message): string => tokenIn(message.text));
  assert.ok(first !== undefined && second !== undefined);
  assert.equal(await verifications.findByTokenHash(hashSecretToken(first)), null);
  assert.notEqual(await verifications.findByTokenHash(hashSecretToken(second)), null);
});
