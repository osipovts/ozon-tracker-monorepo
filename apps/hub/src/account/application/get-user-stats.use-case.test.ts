import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClockPort } from '../../shared/application/clock.port.js';
import { UserEntity } from '../domain/user.entity.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { GetUserStatsUseCase } from './get-user-stats.use-case.js';

const hour = 3_600_000;
const now = new Date('2026-10-31T12:00:00Z');
const clock: ClockPort = { now: (): Date => now };
const ago = (hours: number): Date => new Date(now.getTime() - hours * hour);

void test('counts the users, those with a confirmed email and those who joined in the last day', async (): Promise<void> => {
  const users = new InMemoryUserRepositoryAdapter();
  await users.add(
    UserEntity.register('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11', 'a@example.com', ago(100)),
  );
  await users.add(
    UserEntity.registerVerified('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a12', 'b@example.com', ago(30)),
  );
  await users.add(
    UserEntity.registerVerified('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a13', 'c@example.com', ago(2)),
  );
  await users.add(
    UserEntity.register('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a14', 'd@example.com', ago(1)),
  );

  assert.deepEqual(await new GetUserStatsUseCase(users, clock).execute(), {
    total: 4,
    verified: 2,
    joinedLastDay: 2,
  });
});
