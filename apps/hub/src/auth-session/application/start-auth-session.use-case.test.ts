import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClockPort } from '../../shared/application/clock.port.js';
import { hashSecretToken } from '../../shared/application/secret-token.type.js';
import { InMemoryAuthSessionRepositoryAdapter } from '../infrastructure/in-memory-auth-session-repository.adapter.js';
import { StartAuthSessionUseCase } from './start-auth-session.use-case.js';

const minute = 60_000;
const start = new Date('2026-10-31T10:00:00Z');
const clock: ClockPort = { now: (): Date => start };
const policy = { idleTtlMs: 30 * minute, absoluteTtlMs: 60 * minute };
const userId = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';

void test('starts a session whose token only the client knows: the table keeps its hash', async (): Promise<void> => {
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const useCase = new StartAuthSessionUseCase(sessions, policy, clock);

  const { token, expiresAt } = await useCase.execute({
    userId,
    userAgent: 'Mozilla/5.0',
    ip: '203.0.113.7',
  });

  assert.equal(await sessions.findByTokenHash(token), null);
  const stored = await sessions.findByTokenHash(hashSecretToken(token));
  assert.ok(stored);
  assert.equal(stored.snapshot.userId, userId);
  assert.equal(stored.snapshot.userAgent, 'Mozilla/5.0');
  assert.equal(stored.snapshot.ip, '203.0.113.7');
  assert.deepEqual(expiresAt, new Date(start.getTime() + 60 * minute));
});

void test('gives every session its own token', async (): Promise<void> => {
  const useCase = new StartAuthSessionUseCase(
    new InMemoryAuthSessionRepositoryAdapter(),
    policy,
    clock,
  );

  const first = await useCase.execute({ userId, userAgent: null, ip: null });
  const second = await useCase.execute({ userId, userAgent: null, ip: null });

  assert.notEqual(first.token, second.token);
});
