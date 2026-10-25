import assert from 'node:assert/strict';
import { test } from 'node:test';

import { priceFetchJobSchema } from './price-fetch-job.type.js';
import { priceFetchResultSchema } from './price-fetch-result.type.js';
import { proxyFetchJobSchema } from './proxy-fetch-job.type.js';
import { proxyFetchResultSchema } from './proxy-fetch-result.type.js';
import { sessionExportFileSchema } from './session-export-file.type.js';

const uuid = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';
const session = {
  id: uuid,
  exitIp: '203.0.113.10',
  userAgent: 'Mozilla/5.0',
  storageState: {
    cookies: [
      {
        name: 'abt',
        value: 'v',
        domain: '.ozon.ru',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ],
    origins: [{ origin: 'https://www.ozon.ru', localStorage: [{ name: 'k', value: 'v' }] }],
  },
};

void test('accepts a price fetch job with proxies, a direct route and a session', (): void => {
  const job = {
    jobId: uuid,
    proxies: [
      { server: 'socks5://203.0.113.10:1080', session },
      { server: 'http://user:secret@203.0.113.11:8080' },
      { server: null },
    ],
    products: [{ trackedProductId: uuid, url: 'https://www.ozon.ru/product/1/' }],
    timeoutMs: 15000,
  };
  assert.equal(priceFetchJobSchema.safeParse(job).success, true);
});

void test('rejects empty and malformed price fetch jobs', (): void => {
  const valid = {
    jobId: uuid,
    proxies: [{ server: null }],
    products: [{ trackedProductId: uuid, url: 'https://www.ozon.ru/product/1/' }],
    timeoutMs: 15000,
  };
  for (const invalid of [
    { ...valid, proxies: [] },
    { ...valid, products: [] },
    { ...valid, jobId: 'not-a-uuid' },
    { ...valid, proxies: [{ server: 'ftp://203.0.113.10:21' }] },
    { ...valid, timeoutMs: 5 },
  ]) {
    assert.equal(priceFetchJobSchema.safeParse(invalid).success, false);
  }
});

void test('discriminates price fetch results by type', (): void => {
  assert.equal(
    priceFetchResultSchema.safeParse({
      type: 'product_result',
      jobId: uuid,
      trackedProductId: uuid,
      status: 'challenge_required',
      attempts: [
        {
          proxy: 'socks5://203.0.113.10:1080',
          sessionId: uuid,
          result: { status: 'challenge_required' },
        },
      ],
    }).success,
    true,
  );
  assert.equal(
    priceFetchResultSchema.safeParse({
      type: 'session_update',
      jobId: uuid,
      sessionId: uuid,
      storageState: session.storageState,
      observedAt: '2026-10-24T12:00:00.000Z',
    }).success,
    true,
  );
  assert.equal(priceFetchResultSchema.safeParse({ type: 'unknown' }).success, false);
});

void test('validates proxy fetch jobs and results', (): void => {
  assert.equal(
    proxyFetchJobSchema.safeParse({
      jobId: uuid,
      source: 'github-free-proxy-list',
      maxCandidates: 100,
      probeTimeoutMs: 10000,
    }).success,
    true,
  );
  assert.equal(
    proxyFetchJobSchema.safeParse({
      jobId: uuid,
      source: 'unknown',
      maxCandidates: 1,
      probeTimeoutMs: 1000,
    }).success,
    false,
  );
  assert.equal(
    proxyFetchResultSchema.safeParse({
      type: 'proxy_checks',
      jobId: uuid,
      source: 'github-free-proxy-list',
      checks: [
        {
          server: 'socks5://203.0.113.10:1080',
          alive: true,
          latencyMs: 420,
          country: 'RU',
          exitIp: '203.0.113.10',
          checkedAt: '2026-10-24T12:00:00.000Z',
        },
        {
          server: 'http://203.0.113.11:8080',
          alive: false,
          latencyMs: null,
          country: null,
          exitIp: null,
          checkedAt: '2026-10-24T12:00:00.000Z',
        },
      ],
    }).success,
    true,
  );
});

void test('validates job progress messages of both workers', (): void => {
  for (const message of [
    { type: 'job_started', jobId: uuid },
    { type: 'job_progress', jobId: uuid, processed: 1, total: 2, succeeded: 1 },
    { type: 'job_failed', jobId: uuid, reason: 'Browser crashed', willRetry: true },
    { type: 'job_done', jobId: uuid },
  ])
    assert.equal(priceFetchResultSchema.safeParse(message).success, true);
  for (const message of [
    { type: 'job_started', jobId: uuid },
    { type: 'job_progress', jobId: uuid, processed: 0, total: 20, succeeded: 0 },
    { type: 'job_done', jobId: uuid },
    { type: 'job_failed', jobId: uuid, reason: 'Source down', willRetry: false },
  ])
    assert.equal(proxyFetchResultSchema.safeParse(message).success, true);
  assert.equal(
    proxyFetchResultSchema.safeParse({
      type: 'proxy_checks',
      jobId: uuid,
      source: 'x',
      checks: [],
    }).success,
    false,
  );
});

void test('validates a session export file', (): void => {
  assert.equal(
    sessionExportFileSchema.safeParse({
      marketplace: 'ozon',
      proxy: 'socks5://203.0.113.10:1080',
      session,
      createdAt: '2026-10-24T12:00:00.000Z',
    }).success,
    true,
  );
  assert.equal(
    sessionExportFileSchema.safeParse({
      proxy: null,
      session: { ...session, exitIp: 'x' },
      createdAt: 'x',
    }).success,
    false,
  );
});
