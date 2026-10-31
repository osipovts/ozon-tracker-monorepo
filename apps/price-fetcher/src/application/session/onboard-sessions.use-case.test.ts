import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { CapturedSessionInterface } from '../../domain/session/captured-session.interface.js';
import type { HubSessionsPort } from './hub-sessions.port.js';
import {
  type CaptureDecisionType,
  type CaptureStepInterface,
  OnboardSessionsUseCase,
} from './onboard-sessions.use-case.js';
import type { SessionCaptureInterface, SessionCapturePort } from './session-capture.port.js';

const working = 'socks5://217.71.230.1:1080';
const dead = 'socks5://217.71.230.2:1080';
const skipped = 'socks5://217.71.230.3:1080';
const rejected = 'socks5://217.71.230.4:1080';

function setup(servers: string[]): {
  useCase: OnboardSessionsUseCase;
  uploaded: CapturedSessionInterface[];
  closed: string[];
} {
  const uploaded: CapturedSessionInterface[] = [];
  const closed: string[] = [];

  const hub: HubSessionsPort = {
    listProxiesWithoutSession: (): Promise<string[]> => Promise.resolve(servers),
    uploadSession: (captured): Promise<void> => {
      if (captured.proxy === rejected) return Promise.reject(new Error('HTTP 400'));
      uploaded.push(captured);

      return Promise.resolve();
    },
  };

  const capture: SessionCapturePort = {
    marketplace: 'ozon',
    open: (proxy: ProxyEndpointEntity | null): Promise<SessionCaptureInterface> => {
      const server = proxy?.server ?? 'direct';
      if (server === dead) return Promise.reject(new Error('timeout'));

      return Promise.resolve({
        waitUntilPassed: (): Promise<void> => Promise.resolve(),
        export: (): Promise<CapturedSessionInterface> =>
          Promise.resolve({
            marketplace: 'ozon',
            proxy: server,
            session: {
              id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
              exitIp: '217.71.230.1',
              userAgent: 'Mozilla/5.0',
              storageState: { cookies: [], origins: [] },
            },
            createdAt: '2026-10-24T12:00:00.000Z',
          }),
        close: (): Promise<void> => {
          closed.push(server);

          return Promise.resolve();
        },
      });
    },
  };

  return { useCase: new OnboardSessionsUseCase(hub, capture), uploaded, closed };
}

void test('uploads a session per prepared proxy and explains every skipped one', async (): Promise<void> => {
  const { useCase, uploaded, closed } = setup([
    working,
    dead,
    skipped,
    rejected,
    'socks5://127.0.0.1:1080',
  ]);
  const steps: Array<[string | null, number, number]> = [];

  const summary = await useCase.execute(
    5,
    new AbortController().signal,
    (step: CaptureStepInterface): Promise<CaptureDecisionType> => {
      steps.push([step.server, step.index, step.total]);

      return Promise.resolve(step.server === skipped ? 'skip' : 'save');
    },
  );

  assert.deepEqual(summary.ready, [working]);
  assert.deepEqual(
    summary.skipped.map((item): string | null => item.server),
    [dead, skipped, rejected, 'socks5://127.0.0.1:1080'],
  );
  assert.match(summary.skipped[0]?.reason ?? '', /does not work: timeout/);
  assert.equal(summary.skipped[1]?.reason, 'skipped by the person');
  assert.match(summary.skipped[2]?.reason ?? '', /HTTP 400/);
  assert.equal(summary.skipped[3]?.reason, 'unsupported proxy address');
  assert.deepEqual(
    uploaded.map((item): string | null => item.proxy),
    [working],
  );
  // Every opened window is closed, whatever happened in it.
  assert.deepEqual(closed, [working, skipped, rejected]);
  assert.deepEqual(steps, [
    [working, 0, 5],
    [skipped, 2, 5],
    [rejected, 3, 5],
  ]);
});

void test('a time-out while waiting for the check skips the proxy', async (): Promise<void> => {
  const { useCase, uploaded } = setup([working]);

  const summary = await useCase.execute(
    1,
    new AbortController().signal,
    (): Promise<CaptureDecisionType> => Promise.reject(new Error('The operation timed out')),
  );

  assert.deepEqual(summary.ready, []);
  assert.match(summary.skipped[0]?.reason ?? '', /timed out/);
  assert.equal(uploaded.length, 0);
});

void test('opens one window without a proxy for the direct connection and ignores the proxies of the hub', async (): Promise<void> => {
  const { useCase, uploaded, closed } = setup([working]);

  const summary = await useCase.execute(
    5,
    new AbortController().signal,
    (): Promise<CaptureDecisionType> => Promise.resolve('save'),
    [null],
  );

  assert.deepEqual(summary, { ready: [null], skipped: [] });
  assert.deepEqual(closed, ['direct']);
  assert.equal(uploaded.length, 1);
});

void test('prepares the given proxies with credentials and keeps the credentials out of the summary', async (): Promise<void> => {
  const { useCase, uploaded } = setup([working]);

  const summary = await useCase.execute(
    5,
    new AbortController().signal,
    (): Promise<CaptureDecisionType> => Promise.resolve('save'),
    ['http://user:secret@217.71.230.9:3128', 'http://user:secret@127.0.0.1:3128'],
  );

  assert.deepEqual(summary.ready, ['http://217.71.230.9:3128']);
  assert.deepEqual(
    summary.skipped.map((item): string | null => item.server),
    ['http://127.0.0.1:3128'],
  );
  assert.equal(JSON.stringify(summary).includes('secret'), false);
  assert.equal(uploaded.length, 1);
});

void test('keeps as many windows open at once as the concurrency allows, and reports in the order of the routes', async (): Promise<void> => {
  const servers = [1, 2, 3, 4, 5].map((n): string => `socks5://217.71.230.${String(n)}:1080`);
  let open = 0;
  let peak = 0;
  const capture: SessionCapturePort = {
    marketplace: 'ozon',
    open: (proxy: ProxyEndpointEntity | null): Promise<SessionCaptureInterface> => {
      open += 1;
      peak = Math.max(peak, open);

      return Promise.resolve({
        waitUntilPassed: (): Promise<void> => Promise.resolve(),
        export: (): Promise<CapturedSessionInterface> =>
          Promise.resolve({
            marketplace: 'ozon',
            proxy: proxy?.server ?? null,
            session: {
              id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
              exitIp: '217.71.230.1',
              userAgent: 'Mozilla/5.0',
              storageState: { cookies: [], origins: [] },
            },
            createdAt: '2026-10-24T12:00:00.000Z',
          }),
        close: (): Promise<void> => {
          open -= 1;

          return Promise.resolve();
        },
      });
    },
  };
  const hub: HubSessionsPort = {
    listProxiesWithoutSession: (): Promise<string[]> => Promise.resolve([]),
    uploadSession: (): Promise<void> => Promise.resolve(),
  };

  const summary = await new OnboardSessionsUseCase(hub, capture).execute(
    5,
    new AbortController().signal,
    async (): Promise<CaptureDecisionType> => {
      await new Promise((resolve): void => {
        setImmediate(resolve);
      });

      return 'save';
    },
    servers,
    3,
  );

  assert.equal(peak, 3);
  assert.deepEqual(summary.ready, servers);
});
