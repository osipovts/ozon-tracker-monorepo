import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ProxyFetchResultType } from 'queue-contract';

import type { RefreshProxySourceUseCase } from '../application/refresh-proxy-source.use-case.js';
import { InvalidProxyFetchJobError, ProxyFetchController } from './proxy-fetch.controller.js';

const jobId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';
const job = {
  jobId,
  source: 'github-free-proxy-list',
  maxCandidates: 10,
  probeTimeoutMs: 5000,
};

function createController(
  execute: RefreshProxySourceUseCase['execute'],
  published: ProxyFetchResultType[],
): ProxyFetchController {
  return new ProxyFetchController(
    { 'github-free-proxy-list': { execute } },
    (message): Promise<void> => {
      published.push(message);

      return Promise.resolve();
    },
  );
}

void test('reports the progress of a job from start to finish', async (): Promise<void> => {
  const published: ProxyFetchResultType[] = [];
  const controller = createController(async (_params, _signal, listener): Promise<void> => {
    await listener.onCandidates(1);
    await listener.onChecks([
      {
        server: 'socks5://203.0.113.10:1080',
        alive: true,
        latencyMs: 120,
        country: 'RU',
        exitIp: '203.0.113.10',
        checkedAt: '2026-10-24T12:00:00.000Z',
      },
    ]);
  }, published);

  await controller.handle(job, new AbortController().signal);

  assert.deepEqual(
    published.map((message): string => message.type),
    ['job_started', 'job_progress', 'proxy_checks', 'job_progress', 'job_done'],
  );

  assert.deepEqual(published[1], {
    type: 'job_progress',
    jobId,
    processed: 0,
    total: 1,
    succeeded: 0,
  });
  assert.deepEqual(published[3], {
    type: 'job_progress',
    jobId,
    processed: 1,
    total: 1,
    succeeded: 1,
  });
});

void test('reports a failing source as a failed job and tells whether it is retried', async (): Promise<void> => {
  const published: ProxyFetchResultType[] = [];
  const controller = createController((): Promise<void> => {
    throw new Error('source down');
  }, published);

  await assert.rejects(controller.handle(job, new AbortController().signal, true));

  const failure = published.at(-1);
  assert.ok(failure?.type === 'job_failed');
  assert.equal(failure.reason, 'source down');
  assert.equal(failure.willRetry, true);
});

void test('rejects a malformed job', async (): Promise<void> => {
  const controller = createController((): Promise<void> => Promise.resolve(), []);

  await assert.rejects(
    controller.handle({ jobId: 'nope' }, new AbortController().signal),
    InvalidProxyFetchJobError,
  );
});
