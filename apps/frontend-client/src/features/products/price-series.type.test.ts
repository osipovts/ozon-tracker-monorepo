import { expect, test } from 'vitest';

import { buildPriceSeries, type PricePointInterface } from './price-series.type.js';

const now = new Date(2026, 9, 31, 12, 30);

function at(hour: number, minute: number, amountMinor: number, day = 31): PricePointInterface {
  return { observedAt: new Date(2026, 9, day, hour, minute), amountMinor };
}

test('a point is the average of the hour, with the minimum, the maximum and the last price of it', () => {
  const series = buildPriceSeries(
    [at(12, 5, 100_00), at(12, 20, 140_00), at(12, 10, 120_00)],
    'hour',
    3,
    now,
  );

  expect(series).toHaveLength(3);
  expect(series[2]).toMatchObject({
    observed: true,
    value: 120_00,
    average: 120_00,
    min: 100_00,
    max: 140_00,
    // The last in time, not in the order given.
    last: 140_00,
  });
  expect(series[2]?.start).toEqual(new Date(2026, 9, 31, 12, 0));
});

test('an hour with no price takes the last known one, and says it was not observed', () => {
  const series = buildPriceSeries([at(10, 40, 90_00)], 'hour', 4, now);

  expect(series.map((bucket): number | null => bucket.value)).toEqual([null, 90_00, 90_00, 90_00]);
  expect(series.map((bucket): boolean => bucket.observed)).toEqual([false, true, false, false]);
  expect(series[3]).toMatchObject({ min: null, max: null, last: null, average: null });
});

test('the last price before the chart carries into its first point', () => {
  const series = buildPriceSeries([at(5, 0, 75_00, 28)], 'day', 2, now);

  expect(series.map((bucket): number | null => bucket.value)).toEqual([75_00, 75_00]);
  expect(series.every((bucket): boolean => !bucket.observed)).toBe(true);
});

test('days are counted in the time of the browser, today last', () => {
  const series = buildPriceSeries(
    [at(23, 59, 50_00, 29), at(0, 1, 60_00, 30), at(9, 0, 70_00, 30)],
    'day',
    3,
    now,
  );

  expect(series.map((bucket): number | null => bucket.average)).toEqual([50_00, 65_00, null]);
  expect(series.map((bucket): number | null => bucket.value)).toEqual([50_00, 65_00, 70_00]);
  expect(series[2]?.start).toEqual(new Date(2026, 9, 31, 0, 0));
});

test('without any price there is nothing to draw', () => {
  const series = buildPriceSeries([], 'hour', 2, now);

  expect(series.map((bucket): number | null => bucket.value)).toEqual([null, null]);
});
