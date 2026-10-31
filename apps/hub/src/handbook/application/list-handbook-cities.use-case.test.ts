import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryHandbookRepositoryAdapter } from '../infrastructure/in-memory-handbook-repository.adapter.js';
import { ListHandbookCitiesUseCase } from './list-handbook-cities.use-case.js';

const readAt = new Date('2026-11-01T10:00:00Z');
const cities = [
  { id: '1', name: 'Абакан', region: 'Республика Хакасия' },
  { id: '2', name: 'Иркутск', region: 'Иркутская область' },
  { id: '3', name: 'Ангарск', region: 'Иркутская область' },
  { id: '4', name: 'Москва', region: null },
];

async function setup(): Promise<ListHandbookCitiesUseCase> {
  const repository = new InMemoryHandbookRepositoryAdapter();
  await repository.saveCities('dns-cities', cities, readAt);

  return new ListHandbookCitiesUseCase(repository);
}

void test('gives a page of the cities with the time they were read', async (): Promise<void> => {
  const list = await setup();

  const first = await list.execute('dns-cities', { query: '', page: 1, pageSize: 3 });
  const second = await list.execute('dns-cities', { query: '', page: 2, pageSize: 3 });

  assert.deepEqual(first.fetchedAt, readAt);
  assert.deepEqual(first.page.items, cities.slice(0, 3));
  assert.equal(first.page.total, 4);
  assert.deepEqual(second.page.items, cities.slice(3));
});

void test('finds the cities by a part of the name or of the region, in any case', async (): Promise<void> => {
  const list = await setup();

  const byName = await list.execute('dns-cities', { query: 'АБА', page: 1, pageSize: 10 });
  const byRegion = await list.execute('dns-cities', { query: 'иркутская', page: 1, pageSize: 10 });

  assert.deepEqual(
    byName.page.items.map((city): string => city.name),
    ['Абакан'],
  );
  assert.deepEqual(
    byRegion.page.items.map((city): string => city.name),
    ['Иркутск', 'Ангарск'],
  );
  assert.equal(byRegion.page.total, 2);
});

void test('is empty, and was never read, until the first read is kept', async (): Promise<void> => {
  const empty = new ListHandbookCitiesUseCase(new InMemoryHandbookRepositoryAdapter());

  assert.deepEqual(await empty.execute('dns-cities', { query: 'x', page: 1, pageSize: 10 }), {
    fetchedAt: null,
    page: { items: [], total: 0 },
  });
});
