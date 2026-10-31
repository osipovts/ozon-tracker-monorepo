import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

import { rememberPendingAdd } from './pending-add.type.js';
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
  sessionStorage.clear();
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
  expect(screen.getAllByText('It can take up to 10 minutes.')).toHaveLength(1);
});

test('tells that adding a product can take minutes once it has taken over 5 seconds', async (): Promise<void> => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    vi.stubGlobal(
      'fetch',
      vi.fn((request: Request | string | URL): Promise<Response> =>
        typeof request === 'string' || request instanceof URL || request.method === 'GET'
          ? Promise.resolve(Response.json({ items: [], page: 1, pageSize: 20, total: 0 }))
          : new Promise<Response>(() => undefined),
      ),
    );
    render(
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
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    await user.type(screen.getByLabelText(/link/i), 'https://ozon.ru/t/AbC');
    await user.click(screen.getByRole('button', { name: 'Track' }));
    expect(screen.queryByText(/Adding a product can take a few minutes/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/link/i)).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(screen.getByText(/Adding a product can take a few minutes/)).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('sends again the link whose add was cut short by a reload', async (): Promise<void> => {
  const sent: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request | string | URL): Promise<Response> => {
      if (typeof request === 'string' || request instanceof URL || request.method === 'GET')
        return Response.json({ items: [], page: 1, pageSize: 20, total: 0 });

      sent.push(JSON.stringify(await request.json()));

      return new Promise<Response>(() => undefined);
    }),
  );
  rememberPendingAdd('https://ozon.ru/t/AbC');

  render(
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

  expect(await screen.findByDisplayValue('https://ozon.ru/t/AbC')).toBeDisabled();
  await waitFor((): void => {
    expect(sent).toEqual([JSON.stringify({ url: 'https://ozon.ru/t/AbC' })]);
  });
});
