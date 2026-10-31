import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

import { ProductsPage } from './products.page.js';

const product = {
  marketplace: 'ozon',
  url: 'https://www.ozon.ru/product/1/',
  lastStatus: null,
  lastCheckedAt: null,
  nextCheckAt: null,
  thumbnailUrl: null,
};
const observation = {
  id: '99999999-9999-4999-8999-999999999999',
  observedAt: '2026-10-31T10:00:00.000Z',
  title: 'Notebook',
  availability: 'in_stock',
  prices: [{ amountMinor: 10_000_00, currency: 'RUB' }],
  exitIp: null,
};

beforeEach((): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn((): Promise<Response> =>
      Promise.resolve(
        Response.json({
          items: [
            {
              ...product,
              id: '11111111-1111-4111-8111-111111111111',
              externalId: '1',
              latest: null,
            },
            {
              ...product,
              id: '22222222-2222-4222-8222-222222222222',
              externalId: '2',
              latest: observation,
            },
          ],
          page: 1,
          pageSize: 20,
          total: 2,
        }),
      ),
    ),
  );
});

test('marks the card that waits for its first price, for the glint over it, and no other', async (): Promise<void> => {
  const { container } = render(
    <MantineProvider>
      <MemoryRouter>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <ProductsPage />
        </QueryClientProvider>
      </MemoryRouter>
    </MantineProvider>,
  );

  expect(await screen.findByText('waiting for the first price')).toBeInTheDocument();
  expect(container.querySelectorAll('[data-waiting="true"]')).toHaveLength(1);
  expect(container.querySelectorAll('.mantine-Card-root')).toHaveLength(3);
});
