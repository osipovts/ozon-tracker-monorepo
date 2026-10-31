import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryHandbookRepositoryAdapter } from '../infrastructure/in-memory-handbook-repository.adapter.js';
import { CityExistsUseCase } from './city-exists.use-case.js';
import { MarketplaceWithoutCitiesError } from './marketplace-without-cities.error.js';
import { SaveHandbookCitiesUseCase } from './save-handbook-cities.use-case.js';
import { SearchCitiesUseCase } from './search-cities.use-case.js';

const city = (
  id: string,
  name: string,
  region: string | null = null,
): { id: string; name: string; region: string | null } => ({
  id,
  name,
  region,
});

async function setup(): Promise<{ search: SearchCitiesUseCase; exists: CityExistsUseCase }> {
  const repository = new InMemoryHandbookRepositoryAdapter();
  await new SaveHandbookCitiesUseCase(repository).execute('dns-cities', [
    city('1', 'Абакан'),
    city('2', 'Иваново', 'Ивановская область'),
    city('3', 'Иркутск', 'Иркутская область'),
    city('4', 'Новый Иркутск'),
    city('5', 'Москва'),
  ]);

  return { search: new SearchCitiesUseCase(repository), exists: new CityExistsUseCase(repository) };
}

void test('finds the cities by a part of the name, the ones that begin with it first', async (): Promise<void> => {
  const { search } = await setup();

  const found = await search.execute('dns', { query: 'ИРК', limit: 10 });

  assert.deepEqual(
    found.map((item): string => item.name),
    ['Иркутск', 'Новый Иркутск'],
  );
  assert.deepEqual(found[0], { id: '3', name: 'Иркутск', region: 'Иркутская область' });
});

void test('without a query gives the first cities by name, up to the limit', async (): Promise<void> => {
  const { search } = await setup();

  const found = await search.execute('dns', { query: '', limit: 2 });

  assert.deepEqual(
    found.map((item): string => item.name),
    ['Абакан', 'Иваново'],
  );
});

void test('has no cities until the handbook is read, and none for a marketplace without them', async (): Promise<void> => {
  const empty = new InMemoryHandbookRepositoryAdapter();

  assert.deepEqual(
    await new SearchCitiesUseCase(empty).execute('dns', { query: '', limit: 5 }),
    [],
  );
  await assert.rejects(
    new SearchCitiesUseCase(empty).execute('ozon', { query: '', limit: 5 }),
    MarketplaceWithoutCitiesError,
  );
});

void test('tells whether a marketplace has a city by its id', async (): Promise<void> => {
  const { exists } = await setup();

  assert.equal(await exists.execute('dns', '3'), true);
  assert.equal(await exists.execute('dns', 'nowhere'), false);
  assert.equal(await exists.execute('ozon', '3'), false);
});
