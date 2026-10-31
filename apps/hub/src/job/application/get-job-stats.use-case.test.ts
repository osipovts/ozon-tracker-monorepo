import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClockPort } from '../../shared/application/clock.port.js';
import { JobEntity } from '../domain/job.entity.js';
import { InMemoryJobRepositoryAdapter } from '../infrastructure/in-memory-job-repository.adapter.js';
import { GetJobStatsUseCase } from './get-job-stats.use-case.js';

const hour = 3_600_000;
const now = new Date('2026-10-31T12:00:00Z');
const clock: ClockPort = { now: (): Date => now };
const ago = (hours: number): Date => new Date(now.getTime() - hours * hour);

void test('counts the jobs of the last day by status, and names the latest failures', async (): Promise<void> => {
  const jobs = new InMemoryJobRepositoryAdapter();
  const queued = (id: string, hours: number): JobEntity =>
    JobEntity.queued(
      `3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a${id}`,
      'proxy_fetch',
      'source',
      null,
      ago(hours),
      null,
    );
  await jobs.save(queued('11', 30).completed(ago(30)));
  await jobs.save(queued('12', 5).completed(ago(5)));
  await jobs.save(queued('13', 4).failed('proxies are down', false, ago(4)));
  await jobs.save(queued('14', 3).failed('redis is down', false, ago(3)));
  await jobs.save(queued('15', 2));
  await jobs.save(queued('16', 1).started(ago(1)));

  const stats = await new GetJobStatsUseCase(jobs, clock).execute();

  assert.deepEqual(stats.lastDay, { queued: 1, running: 1, retrying: 0, completed: 1, failed: 2 });
  assert.deepEqual(
    stats.recentFailures.map((failure): string | null => failure.error),
    ['redis is down', 'proxies are down'],
  );
});
