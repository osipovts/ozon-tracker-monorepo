import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { AuthSessionEntity } from '../domain/auth-session.entity.js';
import { PrismaAuthSessionRepositoryAdapter } from './prisma-auth-session-repository.adapter.js';

/** Needs a Postgres with the migrations applied: set TEST_DATABASE_URL to run it (never a database with data that matters). */
const url = process.env['TEST_DATABASE_URL'];
const skip = url === undefined ? 'TEST_DATABASE_URL is not set' : false;

const at = new Date('2026-10-31T10:00:00Z');
const later = new Date('2026-10-31T10:05:00Z');
const policy = { idleTtlMs: 60_000, absoluteTtlMs: 120_000 };

let prisma: PrismaClient;
let sessions: PrismaAuthSessionRepositoryAdapter;
let userId: string;

before(async (): Promise<void> => {
  if (url === undefined) return;

  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  sessions = new PrismaAuthSessionRepositoryAdapter(prisma);
  userId = randomUUID();
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.com` } });
});

after(async (): Promise<void> => {
  if (url === undefined) return;

  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

function newSession(): AuthSessionEntity {
  return AuthSessionEntity.start(
    { id: randomUUID(), userId, tokenHash: randomUUID(), userAgent: 'Firefox', ip: '203.0.113.7' },
    policy,
    at,
  );
}

void test(
  'a request in flight when the session was revoked cannot revive it',
  { skip },
  async (): Promise<void> => {
    const session = newSession();
    await sessions.add(session);
    const { id } = session.snapshot;

    await sessions.revoke(id, later);
    await sessions.touch(id, later, new Date(later.getTime() + policy.idleTtlMs));

    const found = await sessions.findById(id);
    assert.ok(found);
    assert.deepEqual(found.snapshot.revokedAt, later);
    assert.deepEqual(found.snapshot.expiresAt, session.snapshot.expiresAt);
  },
);

void test(
  'revoking all but one ends the others and leaves the one, whatever touches race with it',
  { skip },
  async (): Promise<void> => {
    const [keep, other] = [newSession(), newSession()];
    await sessions.add(keep);
    await sessions.add(other);

    const touches = Array.from({ length: 12 }, (): Promise<void> =>
      sessions.touch(other.snapshot.id, later, new Date(later.getTime() + policy.idleTtlMs)),
    );
    const [revoked] = await Promise.all([
      sessions.revokeOthers(userId, keep.snapshot.id, later),
      ...touches,
    ]);

    assert.equal(revoked >= 1, true);
    assert.notEqual((await sessions.findById(other.snapshot.id))?.snapshot.revokedAt, null);
    assert.equal((await sessions.findById(keep.snapshot.id))?.snapshot.revokedAt, null);
  },
);

void test(
  'touching moves the expiry of a live session, and revoking twice keeps the first time',
  { skip },
  async (): Promise<void> => {
    const session = newSession();
    await sessions.add(session);
    const { id } = session.snapshot;
    const expiresAt = new Date(later.getTime() + policy.idleTtlMs);

    await sessions.touch(id, later, expiresAt);
    assert.deepEqual((await sessions.findById(id))?.snapshot.expiresAt, expiresAt);

    await sessions.revoke(id, later);
    await sessions.revoke(id, new Date(later.getTime() + 1000));
    assert.deepEqual((await sessions.findById(id))?.snapshot.revokedAt, later);
  },
);

void test(
  'deletes the sessions that ended before a time, those that expired and those that were revoked, and no live one',
  { skip },
  async (): Promise<void> => {
    const [expired, revoked, live] = [newSession(), newSession(), newSession()];
    for (const session of [expired, revoked, live]) await sessions.add(session);
    const farLater = new Date(at.getTime() + 10 * 24 * 60 * 60_000);
    const liveSession = AuthSessionEntity.start(
      { id: randomUUID(), userId, tokenHash: randomUUID(), userAgent: null, ip: null },
      policy,
      farLater,
    );
    await sessions.add(liveSession);
    await sessions.revoke(revoked.snapshot.id, at);

    const purged = await sessions.deleteEndedBefore(new Date(farLater.getTime() - 1000));

    assert.ok(purged >= 3);
    assert.equal(await sessions.findById(expired.snapshot.id), null);
    assert.equal(await sessions.findById(revoked.snapshot.id), null);
    assert.notEqual(await sessions.findById(liveSession.snapshot.id), null);
  },
);
