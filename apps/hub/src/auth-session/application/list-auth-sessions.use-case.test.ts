import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClockPort } from '../../shared/application/clock.port.js';
import { InMemoryAuthSessionRepositoryAdapter } from '../infrastructure/in-memory-auth-session-repository.adapter.js';
import { EndAuthSessionUseCase } from './end-auth-session.use-case.js';
import { ListAuthSessionsUseCase } from './list-auth-sessions.use-case.js';
import { StartAuthSessionUseCase } from './start-auth-session.use-case.js';

const minute = 60_000;
const start = new Date('2026-10-31T10:00:00Z');
const policy = { idleTtlMs: 30 * minute, absoluteTtlMs: 60 * minute };
const jane = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';
const sam = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';

void test('lists the live sessions of the user, the latest first, with where they come from', async (): Promise<void> => {
  let current = start;
  const clock: ClockPort = { now: (): Date => current };
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const begin = new StartAuthSessionUseCase(sessions, policy, clock);

  const laptop = await begin.execute({ userId: jane, userAgent: 'Firefox', ip: '203.0.113.7' });
  current = new Date(start.getTime() + 5 * minute);
  const phone = await begin.execute({ userId: jane, userAgent: 'Safari', ip: '198.51.100.2' });
  const ended = await begin.execute({ userId: jane, userAgent: 'Old', ip: null });
  await begin.execute({ userId: sam, userAgent: 'Sam', ip: null });
  await new EndAuthSessionUseCase(sessions, clock).execute(ended.token);

  const list = await new ListAuthSessionsUseCase(sessions, clock).execute(jane);

  assert.deepEqual(
    list.map((session): [string | null, string | null] => [session.userAgent, session.ip]),
    [
      ['Safari', '198.51.100.2'],
      ['Firefox', '203.0.113.7'],
    ],
  );
  assert.equal(laptop.token === phone.token, false);

  current = new Date(start.getTime() + 33 * minute);
  assert.deepEqual(
    (await new ListAuthSessionsUseCase(sessions, clock).execute(jane)).map(
      (session): string | null => session.userAgent,
    ),
    ['Safari'],
  );
});
