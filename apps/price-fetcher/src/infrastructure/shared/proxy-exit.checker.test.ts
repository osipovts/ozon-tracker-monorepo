import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { GeoIpInterface } from './geo-ip-page.parser.js';
import { ProxyExitChecker } from './proxy-exit.checker.js';

const proxy = new ProxyEndpointEntity('socks5://217.71.230.1:1080');

function setup(answers: Array<GeoIpInterface | null>): {
  checker: ProxyExitChecker;
  ask: () => Promise<GeoIpInterface | null>;
  asked: () => number;
  at: (ms: number) => void;
} {
  let asked = 0;
  let now = 0;

  return {
    checker: new ProxyExitChecker(1000, (): number => now),
    ask: (): Promise<GeoIpInterface | null> => {
      const answer = answers[Math.min(asked, answers.length - 1)] ?? null;
      asked += 1;

      return Promise.resolve(answer);
    },
    asked: (): number => asked,
    at: (ms): void => {
      now = ms;
    },
  };
}

void test('confirms an exit in the country asked for, and rejects one in another', async (): Promise<void> => {
  const { checker, ask } = setup([{ ip: '217.71.230.103', country: 'RU' }]);

  assert.deepEqual(await checker.check(proxy, 'RU', ask), {
    status: 'confirmed',
    exitIp: '217.71.230.103',
  });
  assert.deepEqual(await checker.check(proxy, 'DE', ask), { status: 'rejected' });
});

void test('asks the service once for a proxy within the time, and again after it', async (): Promise<void> => {
  const { checker, ask, asked, at } = setup([{ ip: '217.71.230.103', country: 'RU' }]);

  await checker.check(proxy, 'RU', ask);
  at(500);
  await checker.check(proxy, 'RU', ask);
  assert.equal(asked(), 1);

  at(1001);
  await checker.check(proxy, 'RU', ask);
  assert.equal(asked(), 2);
});

void test('does not take a service that did not answer for a verdict on the proxy, and asks again', async (): Promise<void> => {
  const { checker, ask, asked } = setup([null, { ip: '217.71.230.103', country: 'RU' }]);

  assert.deepEqual(await checker.check(proxy, 'RU', ask), { status: 'unavailable' });
  assert.equal((await checker.check(proxy, 'RU', ask)).status, 'confirmed');
  assert.equal(asked(), 2);
});
