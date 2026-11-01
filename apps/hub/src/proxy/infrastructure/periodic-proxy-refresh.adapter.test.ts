import assert from 'node:assert/strict';
import { test } from 'node:test';

import { silentLogger } from 'logger';
import type { ProxySourceType } from 'queue-contract';

import type { GetJobActivityUseCase, JobActivityInterface } from '../../job/application/index.js';
import type { JobKindType } from '../../job/domain/job.entity.js';
import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import type { RefreshProxySourceUseCase } from '../application/refresh-proxy-source.use-case.js';
import { PeriodicProxyRefreshAdapter } from './periodic-proxy-refresh.adapter.js';

type RefreshType = Pick<RefreshProxySourceUseCase, 'execute'>;

const settings = { pauseMs: 600_000, pollMs: 10_000, maxCandidates: 150, probeTimeoutMs: 8000 };
const minute = 60_000;

/** What the proxy jobs are doing, as the activity of the job context tells. */
function activityOf(
  state: JobActivityInterface,
): Pick<GetJobActivityUseCase, 'execute'> & { asked: JobKindType[] } {
  const asked: JobKindType[] = [];

  return {
    asked,
    execute: (kind): Promise<JobActivityInterface> => {
      asked.push(kind);

      return Promise.resolve(state);
    },
  };
}

const idle: JobActivityInterface = { active: false, lastFinishedAt: null };

function recording(failing?: ProxySourceType): {
  refresh: RefreshType;
  calls: Array<[ProxySourceType, number, number, string | null]>;
} {
  const calls: Array<[ProxySourceType, number, number, string | null]> = [];

  return {
    calls,
    refresh: {
      execute: (source, options, requestedBy): Promise<{ jobId: string }> => {
        if (source === failing) return Promise.reject(new Error('redis is down'));
        calls.push([source, options.maxCandidates, options.probeTimeoutMs, requestedBy]);

        return Promise.resolve({ jobId: 'job' });
      },
    },
  };
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve): void => {
    setTimeout(resolve, ms);
  });

void test('queues every source with the settings when the hub starts, for no user', async (): Promise<void> => {
  const { refresh, calls } = recording();
  const adapter = new PeriodicProxyRefreshAdapter(
    refresh,
    activityOf(idle),
    new InMemoryRateLimiterAdapter(),
    settings,
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(30);
  await adapter.onApplicationShutdown();

  assert.deepEqual(calls, [
    ['github-free-proxy-list', 150, 8000, null],
    ['proxifly', 150, 8000, null],
    ['proxyscrape', 150, 8000, null],
  ]);
});

void test('a source that cannot be queued does not keep the others from it', async (): Promise<void> => {
  const { refresh, calls } = recording('proxifly');
  const adapter = new PeriodicProxyRefreshAdapter(
    refresh,
    activityOf(idle),
    new InMemoryRateLimiterAdapter(),
    settings,
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(30);
  await adapter.onApplicationShutdown();

  assert.deepEqual(
    calls.map(([source]): ProxySourceType => source),
    ['github-free-proxy-list', 'proxyscrape'],
  );
});

void test('repeats on every poll once the pause is over, until it shuts down', async (): Promise<void> => {
  const { refresh, calls } = recording();
  const adapter = new PeriodicProxyRefreshAdapter(
    refresh,
    activityOf({ active: false, lastFinishedAt: new Date(Date.now() - 60 * minute) }),
    new InMemoryRateLimiterAdapter(),
    { ...settings, pollMs: 50 },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(200);
  await adapter.onApplicationShutdown();

  // The window is shorter than the interval, so a run is allowed in each of them.
  assert.ok(calls.length >= 6, `queued ${String(calls.length)} refreshes`);
  const stopped = calls.length;
  await wait(100);
  assert.equal(calls.length, stopped);
});

void test('of the instances of the hub that share a Redis only one queues in a window', async (): Promise<void> => {
  const shared = new InMemoryRateLimiterAdapter();
  const [first, second] = [recording(), recording()];
  const adapters = [first, second].map(
    ({ refresh }): PeriodicProxyRefreshAdapter =>
      new PeriodicProxyRefreshAdapter(refresh, activityOf(idle), shared, settings, silentLogger),
  );

  for (const adapter of adapters) adapter.onApplicationBootstrap();
  await wait(30);
  for (const adapter of adapters) await adapter.onApplicationShutdown();

  assert.equal(first.calls.length + second.calls.length, 3);
});

void test('does nothing when the pause is 0', async (): Promise<void> => {
  const { refresh, calls } = recording();
  const adapter = new PeriodicProxyRefreshAdapter(
    refresh,
    activityOf(idle),
    new InMemoryRateLimiterAdapter(),
    { ...settings, pauseMs: 0 },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(30);
  await adapter.onApplicationShutdown();

  assert.equal(calls.length, 0);
});

void test('waits for the proxy jobs that are on their way, and for the pause after the last one ended', async (): Promise<void> => {
  const states: Array<[string, JobActivityInterface, number]> = [
    ['a job is on its way', { active: true, lastFinishedAt: null }, 0],
    [
      'the last job ended a minute ago',
      { active: false, lastFinishedAt: new Date(Date.now() - minute) },
      0,
    ],
    [
      'the last job ended long ago',
      { active: false, lastFinishedAt: new Date(Date.now() - 11 * minute) },
      3,
    ],
  ];

  for (const [, state, queued] of states) {
    const { refresh, calls } = recording();
    const activity = activityOf(state);
    const adapter = new PeriodicProxyRefreshAdapter(
      refresh,
      activity,
      new InMemoryRateLimiterAdapter(),
      settings,
      silentLogger,
    );

    adapter.onApplicationBootstrap();
    await wait(30);
    await adapter.onApplicationShutdown();

    assert.equal(calls.length, queued);
    assert.deepEqual(activity.asked, ['proxy_fetch']);
  }
});
