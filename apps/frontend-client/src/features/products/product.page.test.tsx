import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

import { ProductPage } from './product.page.js';

function observation(n: number, prices: number[] = [n * 100_00]): Record<string, unknown> {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    observedAt: new Date(Date.UTC(2026, 10, 1, 10, 0) - n * 3_600_000).toISOString(),
    title: 'Notebook ASUS',
    availability: n % 2 === 0 ? 'in_stock' : 'out_of_stock',
    prices: prices.map((amountMinor) => ({ amountMinor, currency: 'RUB' })),
    exitIp: null,
  };
}

function stubHub(
  url: string,
  items: Array<Record<string, unknown>> = [],
  product: Record<string, unknown> = {},
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((): Promise<Response> =>
      Promise.resolve(
        Response.json({
          product: {
            id: '11111111-1111-4111-8111-111111111111',
            marketplace: 'ozon',
            externalId: '1',
            url,
            thumbnailUrl: null,
            cityName: null,
            nextCheckAt: null,
            lastCheckedAt: null,
            ...product,
          },
          items,
          page: 1,
          pageSize: 100,
          total: items.length,
        }),
      ),
    ),
  );
}

function renderPage(): void {
  render(
    <MantineProvider env="test">
      <MemoryRouter initialEntries={['/products/11111111-1111-4111-8111-111111111111']}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <Routes>
            <Route path="products/:id" element={<ProductPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    </MantineProvider>,
  );
}

beforeEach((): void => {
  sessionStorage.clear();
});

test('links to the product on its marketplace', async (): Promise<void> => {
  stubHub('https://www.ozon.ru/product/1/');
  renderPage();

  expect(await screen.findByRole('link', { name: /ozon/ })).toHaveAttribute(
    'href',
    'https://www.ozon.ru/product/1/',
  );
});

test('does not link to an address that is not a web page', async (): Promise<void> => {
  stubHub('javascript:alert(1)');
  renderPage();

  expect(await screen.findByText('ozon 1')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /ozon/ })).not.toBeInTheDocument();
});

test('shows the title, the newest price, the availability and the city of a product with a history', async () => {
  stubHub('https://www.ozon.ru/product/1/', [observation(2), observation(3)], {
    cityName: 'Иркутск',
  });
  renderPage();

  expect(await screen.findByRole('heading', { name: 'Notebook ASUS' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/200/);
  expect(screen.getAllByText('in stock').length).toBeGreaterThan(0);
  expect(screen.getByText(/Иркутск/)).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(3);
});

test('says there is no price yet, and no history, for a product nothing was read of', async () => {
  stubHub('https://www.ozon.ru/product/1/');
  renderPage();

  expect(await screen.findByRole('heading', { name: 'ozon 1' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('No price yet');
  expect(screen.getByText('No prices have been read yet.')).toBeInTheDocument();
});

test('pages through a long history', async () => {
  stubHub(
    'https://www.ozon.ru/product/1/',
    Array.from({ length: 25 }, (_, index) => observation(index + 1)),
  );
  renderPage();

  await screen.findByRole('heading', { name: 'Notebook ASUS' });
  expect(screen.getAllByRole('row')).toHaveLength(21);
  await userEvent.click(screen.getByRole('button', { name: '2' }));
  expect(screen.getAllByRole('row')).toHaveLength(6);
});
