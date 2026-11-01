import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { ProxyEntity } from '../domain/proxy.entity.js';
import { PrismaProxyRepositoryAdapter } from './prisma-proxy-repository.adapter.js';

/** Needs a Postgres with the migrations applied: set TEST_DATABASE_URL to run it (never a database with data that matters). */
const url = process.env['TEST_DATABASE_URL'];
const skip = url === undefined ? 'TEST_DATABASE_URL is not set' : false;

let prisma: PrismaClient;
let proxies: PrismaProxyRepositoryAdapter;
const country = `T${randomUUID().slice(0, 1).toUpperCase()}`;

before((): void => {
  if (url === undefined) return;

  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  proxies = new PrismaProxyRepositoryAdapter(prisma);
});

after(async (): Promise<void> => {
  if (url === undefined) return;

  await prisma.proxy.deleteMany({ where: { server: { startsWith: 'socks5://198.51.100.' } } });
  await prisma.$disconnect();
});

function proxy(n: number, disabledAt: Date | null): ProxyEntity {
  return new ProxyEntity({
    server: `socks5://198.51.100.${String(n)}:1080`,
    source: 'github-free-proxy-list',
    country,
    exitIp: null,
    alive: true,
    latencyMs: 100,
    checksTotal: 1,
    checksAlive: 1,
    lastCheckedAt: new Date('2026-10-31T10:00:00Z'),
    disabledAt,
    credentials: null,
  });
}

void test(
  'keeps who is turned off, lists them apart from the others, and deletes one',
  { skip },
  async (): Promise<void> => {
    const off = new Date('2026-10-31T11:00:00Z');
    await proxies.saveMany([proxy(1, null), proxy(2, off)]);

    const page = { page: 1, pageSize: 10 };
    const listed = async (disabled: boolean): Promise<string[]> =>
      (await proxies.list({ country, disabled }, page)).items.map(
        (item): string => item.snapshot.server,
      );

    assert.deepEqual(await listed(true), ['socks5://198.51.100.2:1080']);
    assert.deepEqual(await listed(false), ['socks5://198.51.100.1:1080']);
    assert.deepEqual(
      (await proxies.findByServers(['socks5://198.51.100.2:1080']))[0]?.snapshot.disabledAt,
      off,
    );

    assert.equal(await proxies.delete('socks5://198.51.100.1:1080'), true);
    assert.equal(await proxies.delete('socks5://198.51.100.1:1080'), false);
  },
);

void test(
  'lists proxies of equal quality in one order, whether they are turned off or not',
  { skip },
  async (): Promise<void> => {
    await proxies.saveMany([10, 11, 12, 13].map((n): ProxyEntity => proxy(n, null)));
    const order = async (): Promise<string[]> =>
      (await proxies.list({ country }, { page: 1, pageSize: 10 })).items.map(
        (item): string => item.snapshot.server,
      );
    const before = await order();

    await proxies.saveMany([proxy(11, new Date('2026-10-31T11:00:00Z'))]);
    assert.deepEqual(await order(), before);
    await proxies.saveMany([proxy(11, null)]);
    assert.deepEqual(await order(), before);
  },
);

void test(
  'saves the result of checks without undoing what an administrator set after they were read',
  { skip },
  async (): Promise<void> => {
    const off = new Date('2026-10-31T11:00:00Z');
    await proxies.saveMany([proxy(20, off)]);
    const checked = proxy(20, null);

    await proxies.saveChecked([
      new ProxyEntity({ ...checked.snapshot, checksTotal: 2, checksAlive: 2 }),
    ]);

    const [stored] = await proxies.findByServers(['socks5://198.51.100.20:1080']);
    assert.deepEqual(stored?.snapshot.disabledAt, off);
    assert.equal(stored.snapshot.checksTotal, 2);
  },
);

void test('creates the proxy that a check found', { skip }, async (): Promise<void> => {
  await proxies.saveChecked([proxy(21, null)]);

  const [stored] = await proxies.findByServers(['socks5://198.51.100.21:1080']);
  assert.equal(stored?.snapshot.alive, true);
  assert.equal(stored.snapshot.disabledAt, null);
});
