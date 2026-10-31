import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GetDashboardUseCase } from './get-dashboard.use-case.js';

const now = new Date('2026-10-31T12:00:00Z');

void test('puts the figures of every context on one page, as of now', async (): Promise<void> => {
  const dashboard = await new GetDashboardUseCase(
    { execute: () => Promise.resolve({ total: 5, verified: 3, joinedLastDay: 1 }) },
    { execute: () => Promise.resolve({ products: 7, trackings: 9 }) },
    {
      execute: () =>
        Promise.resolve({
          total: 40,
          alive: 12,
          disabled: 2,
          averageLatencyMs: 310,
          lastCheckedAt: now,
        }),
    },
    { execute: () => Promise.resolve({ active: 2, stale: 1 }) },
    {
      execute: () =>
        Promise.resolve({
          lastDay: { queued: 0, running: 1, retrying: 0, completed: 20, failed: 2 },
          recentFailures: [],
        }),
    },
    { now: (): Date => now },
  ).execute();

  assert.deepEqual(dashboard, {
    generatedAt: now,
    users: { total: 5, verified: 3, joinedLastDay: 1 },
    products: { products: 7, trackings: 9 },
    proxies: { total: 40, alive: 12, disabled: 2, averageLatencyMs: 310, lastCheckedAt: now },
    sessions: { active: 2, stale: 1 },
    jobs: {
      lastDay: { queued: 0, running: 1, retrying: 0, completed: 20, failed: 2 },
      recentFailures: [],
    },
  });
});
