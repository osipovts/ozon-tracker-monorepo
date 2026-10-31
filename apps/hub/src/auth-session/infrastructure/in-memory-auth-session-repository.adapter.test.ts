import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthSessionEntity } from '../domain/auth-session.entity.js';
import { InMemoryAuthSessionRepositoryAdapter } from './in-memory-auth-session-repository.adapter.js';

const at = new Date('2026-10-31T10:00:00Z');
const later = new Date('2026-10-31T10:05:00Z');
const policy = { idleTtlMs: 60_000, absoluteTtlMs: 120_000 };

function newSession(): AuthSessionEntity {
  return AuthSessionEntity.start(
    {
      id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
      userId: '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22',
      tokenHash: 'hash',
      userAgent: null,
      ip: null,
    },
    policy,
    at,
  );
}

void test('finds a session by its token hash and by its id once it is added', async (): Promise<void> => {
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const session = newSession();

  assert.equal(await sessions.findByTokenHash('hash'), null);

  await sessions.add(session);

  assert.equal(await sessions.findByTokenHash('hash'), session);
  assert.equal(await sessions.findById(session.snapshot.id), session);
});

void test('moves the expiry of a live session forward by touching it', async (): Promise<void> => {
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const session = newSession();
  await sessions.add(session);
  const expiresAt = new Date(later.getTime() + policy.idleTtlMs);

  await sessions.touch(session.snapshot.id, later, expiresAt);

  const touched = await sessions.findByTokenHash('hash');
  assert.ok(touched);
  assert.deepEqual(touched.snapshot.lastSeenAt, later);
  assert.deepEqual(touched.snapshot.expiresAt, expiresAt);
});

void test('a request that was in flight when the session was revoked cannot revive it', async (): Promise<void> => {
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const session = newSession();
  await sessions.add(session);

  await sessions.revoke(session.snapshot.id, later);
  // The request read the session before the revocation and writes its touch after it.
  await sessions.touch(session.snapshot.id, later, new Date(later.getTime() + policy.idleTtlMs));

  const found = await sessions.findByTokenHash('hash');
  assert.ok(found);
  assert.deepEqual(found.snapshot.revokedAt, later);
  assert.equal(found.isActive(later), false);
});

void test('revoking keeps the time of the first revocation', async (): Promise<void> => {
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const session = newSession();
  await sessions.add(session);

  await sessions.revoke(session.snapshot.id, at);
  await sessions.revoke(session.snapshot.id, later);

  assert.deepEqual((await sessions.findByTokenHash('hash'))?.snapshot.revokedAt, at);
});
