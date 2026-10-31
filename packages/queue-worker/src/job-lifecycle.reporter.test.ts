import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UnrecoverableError } from 'bullmq';
import { silentLogger } from 'logger';
import type { JobLifecycleType } from 'queue-contract';
import { z } from 'zod';

import { JobLifecycleReporter } from './job-lifecycle.reporter.js';
import { QueueMessageParser } from './queue-message.parser.js';

const jobId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';

function createReporter(published: JobLifecycleType[]): JobLifecycleReporter {
  return new JobLifecycleReporter((message): Promise<void> => {
    published.push(message);

    return Promise.resolve();
  }, silentLogger);
}

void test('reports the start and the end of a job', async (): Promise<void> => {
  const published: JobLifecycleType[] = [];

  await createReporter(published).run(jobId, false, (): Promise<void> => Promise.resolve());

  assert.deepEqual(published, [
    { type: 'job_started', jobId },
    { type: 'job_done', jobId },
  ]);
});

void test('reports a failure, tells whether it is retried and rethrows it', async (): Promise<void> => {
  const published: JobLifecycleType[] = [];

  await assert.rejects(
    createReporter(published).run(jobId, true, (): Promise<void> => {
      throw new Error('source down');
    }),
    /source down/,
  );

  assert.deepEqual(published, [
    { type: 'job_started', jobId },
    { type: 'job_failed', jobId, reason: 'source down', willRetry: true },
  ]);
});

void test('rejects a malformed message for good', (): void => {
  const parser = new QueueMessageParser(silentLogger);
  const schema = z.object({ jobId: z.uuid() });

  assert.deepEqual(parser.parse(schema, { jobId }, 'job'), { jobId });
  assert.throws((): unknown => parser.parse(schema, { jobId: 'nope' }, 'job'), UnrecoverableError);
});
