import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { StoredObjectInterface } from '../../shared/application/object-storage.port.js';
import { InMemoryObjectStorageAdapter } from '../../shared/infrastructure/in-memory-object-storage.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../infrastructure/in-memory-tracked-product-repository.adapter.js';
import type { ImageDownloaderPort } from './image-downloader.port.js';
import {
  StoreProductThumbnailUseCase,
  thumbnailKeyOf,
} from './store-product-thumbnail.use-case.js';

const picture: StoredObjectInterface = {
  body: new Uint8Array([1, 2, 3]),
  contentType: 'image/jpeg',
};

async function setup(
  answer: StoredObjectInterface | null = picture,
  storage = new InMemoryObjectStorageAdapter(),
): Promise<{
  store: StoreProductThumbnailUseCase;
  products: InMemoryTrackedProductRepositoryAdapter;
  storage: InMemoryObjectStorageAdapter;
  downloads: string[];
  id: string;
}> {
  const products = new InMemoryTrackedProductRepositoryAdapter();
  const downloads: string[] = [];
  const downloader: ImageDownloaderPort = {
    download: (url): Promise<StoredObjectInterface | null> => {
      downloads.push(url);

      return Promise.resolve(answer);
    },
  };
  const { product } = await products.add({
    marketplace: 'ozon',
    externalId: '1',
    url: 'https://www.ozon.ru/product/1/',
    cityId: null,
    cityName: null,
  });

  return {
    store: new StoreProductThumbnailUseCase(products, storage, downloader),
    products,
    storage,
    downloads,
    id: product.snapshot.id,
  };
}

void test('keeps the picture under the key of the product, and notes where it came from', async (): Promise<void> => {
  const { store, products, storage, id } = await setup();

  await store.execute(id, 'https://cdn.example/a.jpg');

  assert.deepEqual(storage.objects.get(thumbnailKeyOf(id)), picture);
  const { thumbnailKey, thumbnailSourceUrl } = (await products.findById(id))?.snapshot ?? {};
  assert.equal(thumbnailKey, thumbnailKeyOf(id));
  assert.equal(thumbnailSourceUrl, 'https://cdn.example/a.jpg');
});

void test('does not download a picture it keeps already, and replaces it when the address changes', async (): Promise<void> => {
  const { store, downloads, id } = await setup();

  await store.execute(id, 'https://cdn.example/a.jpg');
  await store.execute(id, 'https://cdn.example/a.jpg');
  assert.deepEqual(downloads, ['https://cdn.example/a.jpg']);

  await store.execute(id, 'https://cdn.example/b.jpg');
  assert.deepEqual(downloads, ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg']);
});

void test('keeps nothing when there is no address, no storage, no such product, or no picture at the address', async (): Promise<void> => {
  const none = await setup(null);
  await none.store.execute(none.id, 'https://cdn.example/a.jpg');
  assert.equal(none.storage.objects.size, 0);
  assert.equal((await none.products.findById(none.id))?.snapshot.thumbnailKey, null);

  const noAddress = await setup();
  await noAddress.store.execute(noAddress.id, null);
  assert.equal(noAddress.downloads.length, 0);

  const off = await setup(picture, new InMemoryObjectStorageAdapter(false));
  await off.store.execute(off.id, 'https://cdn.example/a.jpg');
  assert.equal(off.downloads.length, 0);

  const unknown = await setup();
  await unknown.store.execute('00000000-0000-4000-8000-000000000000', 'https://cdn.example/a.jpg');
  assert.equal(unknown.downloads.length, 0);
});

void test('a picture that cannot be kept is logged, not thrown: the result it came with stays', async (): Promise<void> => {
  const { products, id } = await setup();
  const warnings: string[] = [];
  const failing = new StoreProductThumbnailUseCase(
    products,
    new InMemoryObjectStorageAdapter(),
    {
      download: (): Promise<StoredObjectInterface | null> =>
        Promise.reject(new Error('the connection was reset')),
    },
    {
      debug: (): void => undefined,
      verbose: (): void => undefined,
      info: (): void => undefined,
      warn: (message: string): void => {
        warnings.push(message);
      },
      error: (): void => undefined,
      child: function child() {
        return this;
      },
    },
  );

  await failing.execute(id, 'https://cdn.example/a.jpg');

  assert.match(warnings[0] ?? '', /the connection was reset/);
});
