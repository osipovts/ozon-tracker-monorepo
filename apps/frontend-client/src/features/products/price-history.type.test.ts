import { expect, test } from 'vitest';

import { loadPriceHistory, type PriceHistoryPageInterface } from './price-history.type.js';

interface ObservationStub {
  id: string;
}

/** A hub with so many observations, the newest first (`o10` is the newest of ten), a hundred to a page. */
function hub(
  count: number,
  pageSize = 100,
): {
  fetchPage: (page: number) => Promise<PriceHistoryPageInterface<string, ObservationStub>>;
  asked: number[];
} {
  const all = Array.from({ length: count }, (_, index): ObservationStub => ({
    id: `o${String(count - index)}`,
  }));
  const asked: number[] = [];

  return {
    asked,
    fetchPage: (page) => {
      asked.push(page);

      return Promise.resolve({
        product: `product-at-${String(count)}`,
        items: all.slice((page - 1) * pageSize, page * pageSize),
        total: count,
      });
    },
  };
}

test('reads every page of a history it does not know yet', async () => {
  const { fetchPage, asked } = hub(250);

  const history = await loadPriceHistory(fetchPage);

  expect(history?.observations).toHaveLength(250);
  expect(history?.observations[0]?.id).toBe('o250');
  expect(asked).toEqual([1, 2, 3]);
});

test('reads only the page of the newest observations when it has the rest', async () => {
  const known = await loadPriceHistory(hub(250).fetchPage);
  const { fetchPage, asked } = hub(253);

  const history = await loadPriceHistory(fetchPage, known);

  expect(asked).toEqual([1]);
  expect(history?.observations).toHaveLength(253);
  expect(history?.observations.slice(0, 4).map((item) => item.id)).toEqual([
    'o253',
    'o252',
    'o251',
    'o250',
  ]);
  expect(history?.product).toBe('product-at-253');
});

test('goes on to the next page when more than a page is newer than what it has', async () => {
  const known = await loadPriceHistory(hub(150).fetchPage);
  const { fetchPage, asked } = hub(380);

  const history = await loadPriceHistory(fetchPage, known);

  expect(asked).toEqual([1, 2, 3]);
  expect(history?.observations).toHaveLength(380);
  expect(new Set(history?.observations.map((item) => item.id)).size).toBe(380);
});

test('keeps what it has when nothing is newer, and gives nothing for a product the hub does not have', async () => {
  const known = await loadPriceHistory(hub(120).fetchPage);

  const same = await loadPriceHistory(hub(120).fetchPage, known);
  expect(same?.observations).toEqual(known?.observations);

  expect(await loadPriceHistory(() => Promise.resolve(undefined))).toBeUndefined();
});
