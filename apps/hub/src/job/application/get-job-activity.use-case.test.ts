import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClockPort } from '../../shared/application/clock.port.js';
import { JobEntity, type JobKindType } from '../domain/job.entity.js';
import { InMemoryJobRepositoryAdapter } from '../infrastructure/in-memory-job-repository.adapter.js';
import { GetJobActivityUseCase } from './get-job-activity.use-case.js';

const minute = 60_000;
const now = new Date('2026-11-01T12:00:00Z');
const clock: ClockPort = { now: (): Date => now };
const ago = (minutes: number): Date => new Date(now.getTime() - minutes * minute);

const queued = (id: string, kind: JobKindType, minutes: number): JobEntity =>
  JobEntity.queued(
    `3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a${id}`,
    kind,
    'source',
    null,
    ago(minutes),
    null,
  );

void test('tells nothing of a kind that has no jobs', async (): Promise<void> => {
  const activity = await new GetJobActivityUseCase(
    new InMemoryJobRepositoryAdapter(),
    clock,
  ).execute('proxy_fetch');

  assert.deepEqual(activity, { active: false, lastFinishedAt: null });
});

void test('is active while a job of the kind is queued, running or waiting for a retry', async (): Promise<void> => {
  for (const job of [
    queued('11', 'proxy_fetch', 5),
    queued('12', 'proxy_fetch', 5).started(ago(4)),
    queued('13', 'proxy_fetch', 5).started(ago(4)).failed('timeout', true, ago(3)),
  ]) {
    const jobs = new InMemoryJobRepositoryAdapter();
    await jobs.save(job);

    assert.equal(
      (await new GetJobActivityUseCase(jobs, clock).execute('proxy_fetch')).active,
      true,
    );
  }
});

void test('gives the end of the latest job, completed or failed, and counts the jobs of the kind only', async (): Promise<void> => {
  const jobs = new InMemoryJobRepositoryAdapter();
  await jobs.save(queued('11', 'proxy_fetch', 50).completed(ago(40)));
  await jobs.save(queued('12', 'proxy_fetch', 30).failed('proxies are down', false, ago(20)));
  await jobs.save(queued('13', 'price_fetch', 10).completed(ago(1)));

  assert.deepEqual(await new GetJobActivityUseCase(jobs, clock).execute('proxy_fetch'), {
    active: false,
    lastFinishedAt: ago(20),
  });
});

void test('takes a job that has not ended for an hour for lost', async (): Promise<void> => {
  const jobs = new InMemoryJobRepositoryAdapter();
  await jobs.save(queued('11', 'proxy_fetch', 90));

  assert.equal((await new GetJobActivityUseCase(jobs, clock).execute('proxy_fetch')).active, false);
});
