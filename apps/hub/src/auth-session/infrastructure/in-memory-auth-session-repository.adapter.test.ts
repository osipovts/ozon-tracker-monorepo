import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthSessionEntity } from '../domain/auth-session.entity.js';
import { InMemoryAuthSessionRepositoryAdapter } from './in-memory-auth-session-repository.adapter.js';

const at = new Date('2026-10-31T10:00:00Z');

void test('finds a session by its token hash and sees it revoked once saved so', async (): Promise<void> => {
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const session = AuthSessionEntity.start(
    {
      id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
      userId: '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22',
      tokenHash: 'hash',
      userAgent: null,
      ip: null,
    },
    { idleTtlMs: 60_000, absoluteTtlMs: 120_000 },
    at,
  );

  assert.equal(await sessions.findByTokenHash('hash'), null);

  await sessions.save(session);
  assert.equal(await sessions.findByTokenHash('hash'), session);

  const revoked = session.revoked(at);
  await sessions.save(revoked);
  assert.equal(await sessions.findByTokenHash('hash'), revoked);
});
