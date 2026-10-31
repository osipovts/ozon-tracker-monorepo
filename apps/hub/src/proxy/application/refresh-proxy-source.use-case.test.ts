import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { JobQueuePort } from '../../job/application/job-queue.port.js';
import { ScheduleJobUseCase } from '../../job/application/schedule-job.use-case.js';
import { InMemoryJobRepositoryAdapter } from '../../job/infrastructure/in-memory-job-repository.adapter.js';
import { RefreshProxySourceUseCase } from './refresh-proxy-source.use-case.js';

const admin = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';
const options = { maxCandidates: 50, probeTimeoutMs: 5000 };

function setup(): { refresh: RefreshProxySourceUseCase; jobs: InMemoryJobRepositoryAdapter } {
  const jobs = new InMemoryJobRepositoryAdapter();
  const queue: JobQueuePort = {
    enqueueProxyFetch: (): Promise<void> => Promise.resolve(),
    enqueuePriceFetch: (): Promise<void> => Promise.resolve(),
  };

  return { refresh: new RefreshProxySourceUseCase(new ScheduleJobUseCase(queue, jobs)), jobs };
}

void test('the job of a refresh belongs to the administrator who asked for it, so that they can follow it', async (): Promise<void> => {
  const { refresh, jobs } = setup();

  const { jobId } = await refresh.execute('github-free-proxy-list', options, admin);

  assert.equal((await jobs.findById(jobId))?.snapshot.requestedBy, admin);
});

void test('the job of a refresh asked for with the key of the operator has no user to belong to', async (): Promise<void> => {
  const { refresh, jobs } = setup();

  const { jobId } = await refresh.execute('github-free-proxy-list', options, null);

  assert.equal((await jobs.findById(jobId))?.snapshot.requestedBy, null);
});
