import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonShortLinkParser } from 'product-reference';

import type { RouteInterface } from '../../job/application/index.js';
import { ExpandProductLinkUseCase } from './expand-product-link.use-case.js';
import { NoProxiesAvailableError } from './no-proxies-available.error.js';
import type {
  ProductLinkExpanderPort,
  ProductLinkExpansionInterface,
} from './product-link-expander.port.js';
import { UnsupportedProductUrlError } from './unsupported-product-url.error.js';

const routes: RouteInterface[] = [{ server: null, session: null }];

function useCaseOf(
  expander: ProductLinkExpanderPort,
  chosen: RouteInterface[] = routes,
): ExpandProductLinkUseCase {
  return new ExpandProductLinkUseCase(
    new OzonShortLinkParser(),
    { execute: (): Promise<RouteInterface[]> => Promise.resolve(chosen) },
    expander,
    5000,
  );
}

void test('leaves the links that are not short as they are', async (): Promise<void> => {
  const useCase = useCaseOf({
    expand: (): Promise<string> => Promise.reject(new Error('must not be asked')),
  });

  assert.equal(
    await useCase.execute('https://www.ozon.ru/product/1/'),
    'https://www.ozon.ru/product/1/',
  );
  assert.equal(await useCase.execute('not a url'), 'not a url');
});

void test('asks the worker to expand a short link through the routes', async (): Promise<void> => {
  const asked: ProductLinkExpansionInterface[] = [];
  const useCase = useCaseOf({
    expand: (request): Promise<string> => {
      asked.push(request);

      return Promise.resolve('https://www.ozon.ru/product/1/');
    },
  });

  assert.equal(await useCase.execute('https://ozon.ru/t/AbC'), 'https://www.ozon.ru/product/1/');
  assert.deepEqual(asked, [{ url: 'https://ozon.ru/t/AbC', routes, timeoutMs: 5000 }]);
});

void test('refuses a short link when there is no route or no answer', async (): Promise<void> => {
  await assert.rejects(
    useCaseOf({ expand: (): Promise<string> => Promise.resolve('') }, []).execute(
      'https://ozon.ru/t/AbC',
    ),
    NoProxiesAvailableError,
  );
  await assert.rejects(
    useCaseOf({ expand: (): Promise<string> => Promise.reject(new Error('timeout')) }).execute(
      'https://ozon.ru/t/AbC',
    ),
    UnsupportedProductUrlError,
  );
});
