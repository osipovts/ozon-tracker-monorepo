import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ProxyCheckInterface } from '../domain/proxy-check.interface.js';
import type { ProxyProbePort } from './proxy-probe.port.js';
import type { ProxySourcePort } from './proxy-source.port.js';
import { RefreshProxySourceUseCase } from './refresh-proxy-source.use-case.js';

const candidates = Array.from(
  { length: 7 },
  (_value, index): ProxyEndpointEntity =>
    new ProxyEndpointEntity(`socks5://217.71.230.${String(index + 10)}:1080`),
);
const source: ProxySourcePort = {
  name: 'github-free-proxy-list',
  fetchCandidates: (): Promise<ProxyEndpointEntity[]> => Promise.resolve(candidates),
};
const probe: ProxyProbePort = {
  probe: (proxy): Promise<ProxyCheckInterface> =>
    Promise.resolve({
      server: proxy.server,
      alive: !proxy.server.endsWith('.11:1080'),
      latencyMs: 100,
      country: 'RU',
      exitIp: '217.71.230.1',
      checkedAt: '2026-10-24T12:00:00.000Z',
    }),
};

void test('limits candidates, counts alive proxies and reports checks in batches', async (): Promise<void> => {
  const batches: number[] = [];
  const announced: number[] = [];
  const progress: string[] = [];
  let alive = 0;

  await new RefreshProxySourceUseCase(source, probe, 3, 2).execute(
    { maxCandidates: 5, probeTimeoutMs: 1000 },
    new AbortController().signal,
    {
      onCandidates: (count): Promise<void> => {
        announced.push(count);

        return Promise.resolve();
      },
      onProgress: (checked, aliveSoFar): Promise<void> => {
        progress.push(`${String(checked)}/${String(aliveSoFar)}`);

        return Promise.resolve();
      },
      onChecks: (checks): Promise<void> => {
        batches.push(checks.length);
        alive += checks.filter((check): boolean => check.alive).length;

        return Promise.resolve();
      },
    },
  );

  assert.equal(alive, 4);
  assert.deepEqual(announced, [5]);
  assert.equal(
    batches.reduce((sum, size): number => sum + size, 0),
    5,
  );
  assert.ok(batches.every((size): boolean => size <= 2));
  // Every check is reported on its own, not once for a batch.
  assert.equal(progress.length, 5);
  assert.equal(progress.at(-1)?.split('/')[1], '4');
});

void test('stops probing when the signal is aborted', async (): Promise<void> => {
  const controller = new AbortController();
  await assert.rejects(
    new RefreshProxySourceUseCase(source, probe, 1, 1).execute(
      { maxCandidates: 7, probeTimeoutMs: 1000 },
      controller.signal,
      {
        onCandidates: (): Promise<void> => Promise.resolve(),
        onProgress: (): Promise<void> => Promise.resolve(),
        onChecks: (): Promise<void> => {
          controller.abort();

          return Promise.resolve();
        },
      },
    ),
  );
});
