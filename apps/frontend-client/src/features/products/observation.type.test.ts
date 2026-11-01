import { expect, test } from 'vitest';

import { createI18n } from '../../i18n/i18n.js';
import { availabilityLabel, priceOf, toPoints } from './observation.type.js';
import type { ObservationType } from './use-products.hook.js';

const { t } = createI18n('en');

function observation(prices: number[], at = '2026-11-01T10:00:00.000Z'): ObservationType {
  return {
    id: at,
    observedAt: at,
    title: 'Notebook',
    availability: 'in_stock',
    prices: prices.map((amountMinor) => ({ amountMinor, currency: 'RUB' })),
    exitIp: null,
  };
}

test('takes the first price the marketplace showed, or none when it showed none', () => {
  expect(priceOf(observation([129900, 99900]))).toBe(129900);
  expect(priceOf(observation([]))).toBeNull();
});

test('makes points of the observations that have a price, and leaves out the others', () => {
  const points = toPoints([
    observation([100], '2026-11-01T10:00:00.000Z'),
    observation([], '2026-11-01T11:00:00.000Z'),
  ]);

  expect(points).toEqual([{ observedAt: new Date('2026-11-01T10:00:00.000Z'), amountMinor: 100 }]);
});

test('names the availabilities', () => {
  expect(availabilityLabel('in_stock', t)).toBe('in stock');
  expect(availabilityLabel('out_of_stock', t)).toBe('out of stock');
  expect(availabilityLabel('unknown', t)).toBe('unknown');
});
