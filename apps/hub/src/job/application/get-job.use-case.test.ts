import assert from 'node:assert/strict';
import { test } from 'node:test';

import { JobEntity } from '../domain/job.entity.js';
import { InMemoryJobRepositoryAdapter } from '../infrastructure/in-memory-job-repository.adapter.js';
import { GetJobUseCase } from './get-job.use-case.js';
import { JobNotFoundError } from './job-not-found.error.js';

const jane = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';
const sam = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';
const janesJob = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';
const operatorsJob = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

async function setup(): Promise<GetJobUseCase> {
  const jobs = new InMemoryJobRepositoryAdapter();
  await jobs.save(JobEntity.queued(janesJob, 'price_fetch', 'product', 1, new Date(), jane));
  await jobs.save(JobEntity.queued(operatorsJob, 'proxy_fetch', 'source', null, new Date(), null));

  return new GetJobUseCase(jobs);
}

void test('gives a job to the user who requested it', async (): Promise<void> => {
  const get = await setup();

  assert.equal((await get.execute(jane, janesJob)).snapshot.id, janesJob);
});

void test('to anyone else a job does not exist: a job id is no key to it', async (): Promise<void> => {
  const get = await setup();

  await assert.rejects(get.execute(sam, janesJob), JobNotFoundError);
  await assert.rejects(get.execute(jane, operatorsJob), JobNotFoundError);
  await assert.rejects(get.execute(jane, '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d34'), JobNotFoundError);
});
