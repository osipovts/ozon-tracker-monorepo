import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClockPort } from '../../shared/application/clock.port.js';
import { InMemoryAuthSessionRepositoryAdapter } from '../infrastructure/in-memory-auth-session-repository.adapter.js';
import { PurgeAuthSessionsUseCase } from './purge-auth-sessions.use-case.js';
import { ResolveAuthSessionUseCase } from './resolve-auth-session.use-case.js';
import { RevokeAuthSessionUseCase } from './revoke-auth-session.use-case.js';
import { hashSessionToken } from './session-token.type.js';
import { StartAuthSessionUseCase } from './start-auth-session.use-case.js';

const minute = 60_000;
const day = 24 * 60 * minute;
const start = new Date('2026-10-01T10:00:00Z');
const policy = { idleTtlMs: 30 * minute, absoluteTtlMs: 60 * minute };
const userId = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';

void test('deletes the sessions that ended more than the retention ago, those that expired and those that were revoked, and no other', async (): Promise<void> => {
  let current = start;
  const clock: ClockPort = { now: (): Date => current };
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const begin = new StartAuthSessionUseCase(sessions, policy, clock);
  const resolve = new ResolveAuthSessionUseCase(sessions, policy, clock);
  const revoke = new RevokeAuthSessionUseCase(sessions, clock);

  const expired = await begin.execute({ userId, userAgent: 'expired', ip: null });
  const revokedLongAgo = await begin.execute({ userId, userAgent: 'revoked', ip: null });
  const revokedId = (await resolve.execute(revokedLongAgo.token))?.sessionId ?? '';
  await revoke.execute(userId, revokedId);

  // Ten days later: a session started now is live; one that ended a day or so ago is kept.
  current = new Date(start.getTime() + 10 * day);
  const live = await begin.execute({ userId, userAgent: 'live', ip: null });
  current = new Date(start.getTime() + 10 * day + 31 * minute);
  const endedRecently = await begin.execute({ userId, userAgent: 'recent', ip: null });
  current = new Date(start.getTime() + 10 * day + 100 * minute);

  const purged = await new PurgeAuthSessionsUseCase(sessions, day, clock).execute();

  assert.equal(purged, 2);
  assert.equal(await sessions.findByTokenHash(hashSessionToken(expired.token)), null);
  assert.equal(await sessions.findByTokenHash(hashSessionToken(revokedLongAgo.token)), null);
  assert.notEqual(await sessions.findByTokenHash(hashSessionToken(live.token)), null);
  assert.notEqual(await sessions.findByTokenHash(hashSessionToken(endedRecently.token)), null);
  assert.equal(await new PurgeAuthSessionsUseCase(sessions, day, clock).execute(), 0);
});
