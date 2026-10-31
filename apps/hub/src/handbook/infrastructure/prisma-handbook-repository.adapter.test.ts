import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaHandbookRepositoryAdapter } from './prisma-handbook-repository.adapter.js';

/** Needs a Postgres with the migrations applied: set TEST_DATABASE_URL to run it (never a database with data that matters). */
const url = process.env['TEST_DATABASE_URL'];
const skip = url === undefined ? 'TEST_DATABASE_URL is not set' : false;

let prisma: PrismaClient;
let handbooks: PrismaHandbookRepositoryAdapter;

before((): void => {
  if (url === undefined) return;

  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  handbooks = new PrismaHandbookRepositoryAdapter(prisma);
});

after(async (): Promise<void> => {
  if (url === undefined) return;

  await prisma.handbook.deleteMany({ where: { key: 'dns-cities' } });
  await prisma.$disconnect();
});

void test(
  'keeps the cities of a handbook, and replaces them with the next ones',
  { skip },
  async (): Promise<void> => {
    assert.equal(await handbooks.findCities('dns-cities'), null);

    const first = new Date('2026-11-01T10:00:00Z');
    await handbooks.saveCities('dns-cities', [{ id: '1', name: 'Абакан', region: null }], first);
    assert.deepEqual(await handbooks.findCities('dns-cities'), {
      cities: [{ id: '1', name: 'Абакан', region: null }],
      fetchedAt: first,
    });

    const second = new Date('2026-11-02T10:00:00Z');
    await handbooks.saveCities(
      'dns-cities',
      [{ id: '2', name: 'Иркутск', region: 'Иркутская область' }],
      second,
    );
    assert.deepEqual(await handbooks.findCities('dns-cities'), {
      cities: [{ id: '2', name: 'Иркутск', region: 'Иркутская область' }],
      fetchedAt: second,
    });
  },
);
