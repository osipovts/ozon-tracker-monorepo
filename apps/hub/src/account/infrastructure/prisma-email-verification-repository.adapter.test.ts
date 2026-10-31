import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { EmailVerificationEntity } from '../domain/email-verification.entity.js';
import { PrismaEmailVerificationRepositoryAdapter } from './prisma-email-verification-repository.adapter.js';

/** Needs a Postgres with the migrations applied: set TEST_DATABASE_URL to run it (never a database with data that matters). */
const url = process.env['TEST_DATABASE_URL'];
const skip = url === undefined ? 'TEST_DATABASE_URL is not set' : false;

let prisma: PrismaClient;
let verifications: PrismaEmailVerificationRepositoryAdapter;
let userId: string;

before(async (): Promise<void> => {
  if (url === undefined) return;

  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  verifications = new PrismaEmailVerificationRepositoryAdapter(prisma);
  userId = randomUUID();
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.com` } });
});

after(async (): Promise<void> => {
  if (url === undefined) return;

  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

function link(): EmailVerificationEntity {
  return EmailVerificationEntity.issue(
    { id: randomUUID(), userId, tokenHash: randomUUID() },
    60_000,
    new Date(),
  );
}

void test(
  'keeps one link per user: a new one replaces the earlier, and is found by its hash',
  { skip },
  async (): Promise<void> => {
    const [first, second] = [link(), link()];

    await verifications.replaceForUser(first);
    await verifications.replaceForUser(second);

    assert.equal(await verifications.findByTokenHash(first.snapshot.tokenHash), null);
    const found = await verifications.findByTokenHash(second.snapshot.tokenHash);
    assert.ok(found);
    assert.equal(found.snapshot.userId, userId);
    assert.deepEqual(found.snapshot.expiresAt, second.snapshot.expiresAt);
    assert.equal(await prisma.emailVerification.count({ where: { userId } }), 1);
  },
);
