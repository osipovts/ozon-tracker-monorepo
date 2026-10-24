import assert from 'node:assert/strict';
import { test } from 'node:test';

import { JobEntity } from '../domain/job.entity.js';
import { InMemoryJobRepositoryAdapter } from '../infrastructure/in-memory-job-repository.adapter.js';
import { GetJobUseCase } from './get-job.use-case.js';
import { JobNotFoundError } from './job-not-found.error.js';
import { RecordJobEventUseCase } from './record-job-event.use-case.js';

const jobId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';

async function setup(): Promise<{ record: RecordJobEventUseCase; get: GetJobUseCase }> {
  const jobs = new InMemoryJobRepositoryAdapter();
  await jobs.save(JobEntity.queued(jobId, 'price_fetch', 'product', 2, new Date()));
  return { record: new RecordJobEventUseCase(jobs), get: new GetJobUseCase(jobs) };
}

void test('applies the events of a job in order and reports its progress', async (): Promise<void> => {
  const { record, get } = await setup();
  await record.execute({ type: 'started', jobId, at: new Date() });
  await record.execute({
    type: 'progress',
    jobId,
    at: new Date(),
    progress: { percent: 50, processed: 1, total: 2, succeeded: 1 },
  });
  const running = await get.execute(jobId);
  assert.equal(running.snapshot.status, 'running');
  assert.equal(running.snapshot.percent, 50);
  await record.execute({ type: 'completed', jobId, at: new Date() });
  const done = await get.execute(jobId);
  assert.equal(done.snapshot.status, 'completed');
  assert.equal(done.snapshot.percent, 100);
});

void test('a redelivered progress message does not move the job back or count twice', async (): Promise<void> => {
  const { record, get } = await setup();
  const progress = { percent: 50, processed: 1, total: 2, succeeded: 1 };
  await record.execute({ type: 'progress', jobId, at: new Date(), progress });
  await record.execute({ type: 'progress', jobId, at: new Date(), progress });
  assert.equal((await get.execute(jobId)).snapshot.processed, 1);
  await record.execute({ type: 'completed', jobId, at: new Date() });
  await record.execute({ type: 'progress', jobId, at: new Date(), progress });
  assert.equal((await get.execute(jobId)).snapshot.status, 'completed');
});

void test('ignores events of unknown jobs and rejects asking for them', async (): Promise<void> => {
  const { record, get } = await setup();
  const unknown = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';
  await record.execute({ type: 'started', jobId: unknown, at: new Date() });
  await assert.rejects(get.execute(unknown), JobNotFoundError);
});
