import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

import { ProductPage } from './product.page.js';

function stubHub(url: string): void {
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
          },
          items: [],
          page: 1,
          pageSize: 100,
          total: 0,
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
