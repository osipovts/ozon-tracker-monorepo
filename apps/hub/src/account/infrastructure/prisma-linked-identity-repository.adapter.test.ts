import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import type { UnlinkOutcomeType } from '../application/linked-identity-repository.port.js';
import { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import { PrismaLinkedIdentityRepositoryAdapter } from './prisma-linked-identity-repository.adapter.js';

/** Needs a Postgres with the migrations applied: set TEST_DATABASE_URL to run it (never a database with data that matters). */
const url = process.env['TEST_DATABASE_URL'];
const skip = url === undefined ? 'TEST_DATABASE_URL is not set' : false;

let prisma: PrismaClient;
let identities: PrismaLinkedIdentityRepositoryAdapter;
const userIds: string[] = [];

before((): void => {
  if (url === undefined) return;

  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  identities = new PrismaLinkedIdentityRepositoryAdapter(prisma);
});

after(async (): Promise<void> => {
  if (url === undefined) return;

  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

/** A user linked to Google and GitHub. */
async function userWithTwoLinks(): Promise<string> {
  const id = randomUUID();
  userIds.push(id);
  await prisma.user.create({ data: { id, email: `${id}@example.com` } });
  for (const provider of ['google', 'github'] as const) {
    await identities.add(
      new LinkedIdentityEntity({
        id: randomUUID(),
        userId: id,
        provider,
        subject: `${provider}-${id}`,
        createdAt: new Date(),
      }),
    );
  }

  return id;
}

void test(
  'an unlink waits for another that is in progress for the same user, and sees what it left',
  { skip },
  async (): Promise<void> => {
    const userId = await userWithTwoLinks();
    let second: Promise<UnlinkOutcomeType> | undefined;

    // The first unlink is in progress: it holds the user and has taken GitHub away, but is not done.
    await prisma.$transaction(async (tx): Promise<void> => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      await tx.linkedIdentity.deleteMany({ where: { userId, provider: 'github' } });
      second = identities.unlink(userId, 'google', false);
      await new Promise((resolve): void => {
        setTimeout(resolve, 300);
      });
    });

    assert.equal(await second, 'last_login_method');
    assert.equal((await identities.listByUser(userId)).length, 1);
  },
);

void test(
  'unlinks the last link of a user who has a password, and says when there is none to unlink',
  { skip },
  async (): Promise<void> => {
    const userId = await userWithTwoLinks();

    assert.equal(await identities.unlink(userId, 'google', true), 'unlinked');
    assert.equal(await identities.unlink(userId, 'github', true), 'unlinked');
    assert.equal(await identities.unlink(userId, 'github', true), 'not_linked');
  },
);
