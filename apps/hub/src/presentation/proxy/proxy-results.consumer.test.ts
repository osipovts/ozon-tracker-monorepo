import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UnrecoverableError } from 'bullmq';
import { silentLogger } from 'logger';
import { QueueMessageParser } from 'queue-worker';

import { RecordJobEventUseCase } from '../../application/job/record-job-event.use-case.js';
import { RecordProxyChecksUseCase } from '../../application/proxy/record-proxy-checks.use-case.js';
import { JobEntity } from '../../domain/job/job.entity.js';
import { InMemoryJobRepositoryAdapter } from '../../infrastructure/job/in-memory-job-repository.adapter.js';
import { InMemoryProxyRepositoryAdapter } from '../../infrastructure/proxy/in-memory-proxy-repository.adapter.js';
import type { AppConfigInterface } from '../../infrastructure/shared/app-config.interface.js';
import { ProxyResultsConsumer } from './proxy-results.consumer.js';

const config: AppConfigInterface = {
  databaseUrl: 'postgresql://localhost:5432/hub',
  redisUrl: 'redis://localhost:6379',
  port: 3000,
  priceProxyCount: 5,
  priceTimeoutMs: 60000,
  logLevel: 'error',
};

const jobId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';

void test('stores the checks of a source and ignores its completion message', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();
  const consumer = new ProxyResultsConsumer(
    new RecordProxyChecksUseCase(repository),
    new RecordJobEventUseCase(new InMemoryJobRepositoryAdapter()),
    new QueueMessageParser(silentLogger),
    config,
    silentLogger,
  );

  await consumer.handle({
    type: 'proxy_checks',
    jobId,
    source: 'github-free-proxy-list',
    checks: [
      {
        server: 'socks5://217.71.230.1:1080',
        alive: true,
        latencyMs: 250,
        country: 'RU',
        exitIp: '217.71.230.1',
        checkedAt: '2026-10-24T12:00:00.000Z',
      },
      {
        server: 'http://217.71.230.2:8080',
        alive: false,
        latencyMs: null,
        country: null,
        exitIp: null,
        checkedAt: '2026-10-24T12:00:00.000Z',
      },
    ],
  });

  const page = await repository.list({}, { page: 1, pageSize: 10 });
  assert.deepEqual(
    page.items.map((proxy): [string, boolean] => [proxy.snapshot.server, proxy.snapshot.alive]),
    [
      ['socks5://217.71.230.1:1080', true],
      ['http://217.71.230.2:8080', false],
    ],
  );
});

void test('rejects a malformed message for good', async (): Promise<void> => {
  const consumer = new ProxyResultsConsumer(
    new RecordProxyChecksUseCase(new InMemoryProxyRepositoryAdapter()),
    new RecordJobEventUseCase(new InMemoryJobRepositoryAdapter()),
    new QueueMessageParser(silentLogger),
    config,
    silentLogger,
  );

  await assert.rejects(consumer.handle({ type: 'proxy_checks', checks: 1 }), UnrecoverableError);
});

void test('tracks the progress of a proxy job until it is done', async (): Promise<void> => {
  const jobs = new InMemoryJobRepositoryAdapter();
  await jobs.save(
    JobEntity.queued(jobId, 'proxy_fetch', 'github-free-proxy-list', null, new Date()),
  );
  const consumer = new ProxyResultsConsumer(
    new RecordProxyChecksUseCase(new InMemoryProxyRepositoryAdapter()),
    new RecordJobEventUseCase(jobs),
    new QueueMessageParser(silentLogger),
    config,
    silentLogger,
  );

  await consumer.handle({ type: 'job_started', jobId });
  await consumer.handle({
    type: 'job_progress',
    jobId,
    processed: 5,
    total: 20,
    succeeded: 2,
  });

  const running = await jobs.findById(jobId);
  assert.deepEqual(
    running && [running.snapshot.status, running.percent, running.snapshot.succeeded],
    ['running', 25, 2],
  );

  await consumer.handle({ type: 'job_failed', jobId, reason: 'Source down', willRetry: true });
  assert.equal((await jobs.findById(jobId))?.snapshot.status, 'retrying');

  await consumer.handle({ type: 'job_done', jobId });
  const done = await jobs.findById(jobId);
  assert.deepEqual(done && [done.snapshot.status, done.percent], ['completed', 100]);
});
