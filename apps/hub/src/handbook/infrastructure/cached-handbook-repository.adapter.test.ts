import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { HandbookCityType } from 'queue-contract';

import { CachedHandbookRepositoryAdapter } from './cached-handbook-repository.adapter.js';
import { InMemoryHandbookRepositoryAdapter } from './in-memory-handbook-repository.adapter.js';

const moscow: HandbookCityType = { id: 'moscow', name: 'Москва', region: null };
const irkutsk: HandbookCityType = { id: 'irkutsk', name: 'Иркутск', region: null };
const start = new Date('2026-11-01T10:00:00Z');

/** A store that counts the reads, and a clock that is moved by hand. */
function setup(): {
  cached: CachedHandbookRepositoryAdapter;
  store: InMemoryHandbookRepositoryAdapter;
  reads: () => number;
  at: (seconds: number) => void;
} {
  let reads = 0;
  let now = start;
  const store = new InMemoryHandbookRepositoryAdapter();
  const counting = {
    findCities: (
      ...args: Parameters<typeof store.findCities>
    ): ReturnType<typeof store.findCities> => {
      reads += 1;

      return store.findCities(...args);
    },
    saveCities: store.saveCities.bind(store),
  };

  return {
    cached: new CachedHandbookRepositoryAdapter(counting, 60_000, { now: (): Date => now }),
    store,
    reads: (): number => reads,
    at: (seconds): void => {
      now = new Date(start.getTime() + seconds * 1000);
    },
  };
}

void test('reads the store once for the asks that come within the time', async (): Promise<void> => {
  const { cached, store, reads, at } = setup();
  await store.saveCities('dns-cities', [moscow], start);

  await cached.findCities('dns-cities');
  at(30);
  const again = await cached.findCities('dns-cities');
  assert.deepEqual(again?.cities, [moscow]);
  assert.equal(reads(), 1);

  at(61);
  await cached.findCities('dns-cities');
  assert.equal(reads(), 2);
});

void test('sees its own save at once, and remembers that there was nothing', async (): Promise<void> => {
  const { cached, reads } = setup();

  assert.equal(await cached.findCities('dns-cities'), null);
  assert.equal(await cached.findCities('dns-cities'), null);
  assert.equal(reads(), 1);

  await cached.saveCities('dns-cities', [irkutsk], start);
  assert.deepEqual((await cached.findCities('dns-cities'))?.cities, [irkutsk]);
});
