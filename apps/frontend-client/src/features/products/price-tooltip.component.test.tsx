import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { toRows } from './chart-rows.type.js';
import type { PriceBucketInterface } from './price-series.type.js';
import { PriceTooltip } from './price-tooltip.component.js';

function rowOf(overrides: Partial<PriceBucketInterface>): ReturnType<typeof toRows>[number] {
  const [row] = toRows([
    {
      start: new Date(2026, 10, 1, 14),
      value: null,
      observed: false,
      min: null,
      max: null,
      last: null,
      average: null,
      ...overrides,
    },
  ]);
  if (row === undefined) throw new Error('no row');

  return row;
}

function show(overrides: Partial<PriceBucketInterface>): void {
  render(
    <MantineProvider>
      <PriceTooltip row={rowOf(overrides)} granularity="hour" />
    </MantineProvider>,
  );
}

test('tells the average, the minimum, the maximum and the last price of an hour with prices', () => {
  show({
    value: 130000,
    observed: true,
    average: 130000,
    min: 120000,
    max: 140000,
    last: 125000,
  });

  expect(screen.getByText(/Average/)).toBeInTheDocument();
  expect(screen.getByText(/Minimum|Min/)).toBeInTheDocument();
  expect(screen.getByText(/Maximum|Max/)).toBeInTheDocument();
  expect(screen.getByText(/Last/)).toBeInTheDocument();
});

test('tells the last known price for an hour with none observed', () => {
  show({ value: 130000, observed: false });

  expect(screen.getByText(/last known|Last known/i)).toBeInTheDocument();
  expect(screen.queryByText(/Average/)).not.toBeInTheDocument();
});

test('says there was no price yet before the first one', () => {
  show({ value: null, observed: false });

  expect(screen.getByText(/no price yet|No price yet/i)).toBeInTheDocument();
});
