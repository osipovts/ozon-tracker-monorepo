import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { ProxiesPage } from './proxies.page.js';

const pageSize = 20;
let servers: string[] = [];

function proxy(server: string): Record<string, unknown> {
  return {
    server,
    source: 'proxifly',
    country: null,
    alive: true,
    latencyMs: 120,
    successRate: 1,
    checksTotal: 3,
    lastCheckedAt: '2026-11-01T10:00:00.000Z',
    disabled: false,
  };
}

beforeEach((): void => {
  servers = Array.from(
    { length: pageSize + 1 },
    (_, index): string => `http://10.0.0.${String(index)}:80`,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request): Promise<Response> => {
      const { pathname, searchParams } = new URL(request.url);

      if (pathname === '/proxies' && request.method === 'GET') {
        const page = Number(searchParams.get('page'));

        return Promise.resolve(
          Response.json({
            items: servers.slice((page - 1) * pageSize, page * pageSize).map(proxy),
            page,
            pageSize,
            total: servers.length,
          }),
        );
      }
      if (pathname === '/proxies' && request.method === 'DELETE') {
        servers = servers.filter((server): boolean => server !== searchParams.get('server'));

        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (pathname === '/jobs') {
        return Promise.resolve(Response.json({ items: [], page: 1, pageSize: 100, total: 0 }));
      }

      return Promise.resolve(Response.json({}, { status: 404 }));
    }),
  );
});

function renderPage(): void {
  render(
    <MantineProvider env="test">
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ProxiesPage />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

async function deleteFirstProxy(user: UserEvent): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
  );
}

test('goes back a page when the last proxy of the last page is deleted', async (): Promise<void> => {
  renderPage();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '2' }));
  await deleteFirstProxy(user);

  expect(await screen.findByText('http://10.0.0.0:80')).toBeInTheDocument();
});

test('stays on the first page when the only proxy is deleted', async (): Promise<void> => {
  servers = ['http://10.0.0.0:80'];
  renderPage();
  await deleteFirstProxy(userEvent.setup());

  expect(await screen.findByText('No proxies match.')).toBeInTheDocument();
  expect(
    vi
      .mocked(fetch)
      .mock.calls.every(
        ([request]): boolean => request instanceof Request && !request.url.includes('page=0'),
      ),
  ).toBe(true);
});
