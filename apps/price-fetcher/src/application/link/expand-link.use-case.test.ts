import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  OzonReferenceParser,
  OzonShortLinkParser,
  ResolveProductReferenceUseCase,
} from 'product-reference';

import { ExpandLinkUseCase } from './expand-link.use-case.js';
import type { LinkExpanderPort } from './link-expander.port.js';

const job = {
  url: 'https://ozon.ru/t/AbC123',
  routes: [{ server: null }],
  timeoutMs: 5000,
};

function useCaseOf(expander: LinkExpanderPort): ExpandLinkUseCase {
  return new ExpandLinkUseCase(
    new OzonShortLinkParser(),
    new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
    () => expander,
  );
}

void test('answers with the canonical address of the product', async (): Promise<void> => {
  const url = await useCaseOf({
    expand: (): Promise<string> =>
      Promise.resolve('https://www.ozon.ru/product/asus-zenbook-4775581891/?at=x'),
  }).execute(job, new AbortController().signal);

  assert.equal(url, 'https://www.ozon.ru/product/4775581891/');
});

void test('fails when the link leads to no product', async (): Promise<void> => {
  const useCase = useCaseOf({
    expand: (): Promise<string> => Promise.resolve('https://www.ozon.ru/category/1/'),
  });

  await assert.rejects(useCase.execute(job, new AbortController().signal));
});

void test('refuses to open what is not a short link', async (): Promise<void> => {
  let opened = false;
  const useCase = useCaseOf({
    expand: (): Promise<null> => {
      opened = true;

      return Promise.resolve(null);
    },
  });

  await assert.rejects(
    useCase.execute({ ...job, url: 'https://evil.test/t/abc' }, new AbortController().signal),
  );
  assert.equal(opened, false);
});
