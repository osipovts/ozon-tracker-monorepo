import assert from 'node:assert/strict';
import { test } from 'node:test';

import { silentLogger } from 'logger';

import type { PurgeAuthSessionsUseCase } from '../application/purge-auth-sessions.use-case.js';
import { PeriodicAuthSessionPurgeAdapter } from './periodic-auth-session-purge.adapter.js';

function counting(): { purge: Pick<PurgeAuthSessionsUseCase, 'execute'>; calls: () => number } {
  let calls = 0;
  const purge = {
    execute: (): Promise<number> => {
      calls += 1;

      return Promise.resolve(0);
    },
  };

  return { purge, calls: (): number => calls };
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve): void => {
    setTimeout(resolve, ms);
  });

void test('purges at once when the hub starts and then on every interval, until it shuts down', async (): Promise<void> => {
  const { purge, calls } = counting();
  const adapter = new PeriodicAuthSessionPurgeAdapter(purge, 20, silentLogger);

  adapter.onApplicationBootstrap();
  assert.equal(calls(), 1);
  await wait(110);
  assert.ok(calls() >= 4, `purged ${String(calls())} times`);

  await adapter.onApplicationShutdown();
  const stopped = calls();
  await wait(60);
  assert.equal(calls(), stopped);
});

void test('a purge that fails is logged and tried again, it does not take the hub down', async (): Promise<void> => {
  let calls = 0;
  const warnings: string[] = [];
  const failing = {
    execute: (): Promise<number> => {
      calls += 1;

      return Promise.reject(new Error('database is down'));
    },
  };
  const adapter = new PeriodicAuthSessionPurgeAdapter(failing, 20, {
    ...silentLogger,
    warn: (message: string): void => {
      warnings.push(message);
    },
  });

  adapter.onApplicationBootstrap();
  await wait(70);
  await adapter.onApplicationShutdown();

  assert.ok(calls >= 2);
  assert.ok(warnings.length >= 2);
  assert.match(warnings[0] ?? '', /database is down/);
});
