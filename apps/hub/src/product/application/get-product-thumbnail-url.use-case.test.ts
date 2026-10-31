import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryObjectStorageAdapter } from '../../shared/infrastructure/in-memory-object-storage.adapter.js';
import { GetProductThumbnailUrlUseCase } from './get-product-thumbnail-url.use-case.js';

function at(iso: string): { now: () => Date } {
  return { now: (): Date => new Date(iso) };
}

void test('is none for a product with no picture, or with no storage', async (): Promise<void> => {
  assert.equal(
    await new GetProductThumbnailUrlUseCase(new InMemoryObjectStorageAdapter()).execute(null),
    null,
  );
  assert.equal(
    await new GetProductThumbnailUrlUseCase(new InMemoryObjectStorageAdapter(false)).execute('k'),
    null,
  );
});

void test('is the same address for a whole hour, and a new one in the next, valid for at least an hour', async (): Promise<void> => {
  const storage = new InMemoryObjectStorageAdapter();
  const first = await new GetProductThumbnailUrlUseCase(
    storage,
    at('2026-10-31T14:05:00Z'),
  ).execute('k');
  const sameHour = await new GetProductThumbnailUrlUseCase(
    storage,
    at('2026-10-31T14:59:00Z'),
  ).execute('k');
  const nextHour = await new GetProductThumbnailUrlUseCase(
    storage,
    at('2026-10-31T15:01:00Z'),
  ).execute('k');

  assert.equal(first, sameHour);
  assert.notEqual(first, nextHour);
  // Signed at 14:00 for two hours: good until 16:00, an hour after the last moment of the hour it was given in.
  assert.match(
    first ?? '',
    new RegExp(`expires=${String(Date.parse('2026-10-31T16:00:00Z') / 1000)}`),
  );
});
