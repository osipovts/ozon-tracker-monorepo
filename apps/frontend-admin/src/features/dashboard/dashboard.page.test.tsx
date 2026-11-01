import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { DashboardPage } from './dashboard.page.js';

function dashboardOf(recentFailures: Array<Record<string, unknown>>): object {
  return {
    users: { total: 12, verified: 9, joinedLastDay: 2 },
    products: { products: 30, trackings: 41 },
    proxies: {
      total: 80,
      alive: 25,
      disabled: 3,
      averageLatencyMs: 250,
      lastCheckedAt: '2026-11-01T10:00:00.000Z',
    },
    jobs: {
      lastDay: { queued: 1, running: 2, retrying: 3, completed: 4, failed: 5 },
      recentFailures,
    },
  };
}

function stubHub(answer: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((): Promise<Response> => Promise.resolve(answer.clone())),
  );
}

function renderPage(): void {
  render(
    <MantineProvider env="test">
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DashboardPage />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

test('shows the figures of the users, the products, the proxies and the jobs of the last day', async () => {
  stubHub(Response.json(dashboardOf([])));
  renderPage();

  expect(await screen.findByText('12')).toBeInTheDocument();
  expect(screen.getByText('9 verified, 2 joined in a day')).toBeInTheDocument();
  expect(screen.getByText('41 trackings')).toBeInTheDocument();
  expect(screen.getByText('25 / 80')).toBeInTheDocument();
  expect(screen.getByText('3 turned off')).toBeInTheDocument();
  for (const badge of ['queued 1', 'running 2', 'retrying 3', 'completed 4', 'failed 5'])
    expect(screen.getByText(badge)).toBeInTheDocument();
  expect(screen.getByText('None.')).toBeInTheDocument();
});

test('lists the recent failures with their error, and a dash for what is not known', async () => {
  const failures = [
    {
      id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
      kind: 'price_fetch',
      subject: 'ozon',
      error: 'proxy refused',
      finishedAt: '2026-11-01T09:00:00.000Z',
    },
    {
      id: '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33',
      kind: 'proxy_fetch',
      subject: 'proxifly',
      error: null,
      finishedAt: null,
    },
  ];
  stubHub(Response.json(dashboardOf(failures)));
  renderPage();

  expect(await screen.findByText('proxy refused')).toBeInTheDocument();
  expect(screen.getByText('proxifly')).toBeInTheDocument();
  expect(screen.getAllByText('-')).toHaveLength(2);
  expect(screen.queryByText('None.')).not.toBeInTheDocument();
});

test('says what went wrong when the hub refuses', async () => {
  stubHub(Response.json({ message: 'Forbidden' }, { status: 403 }));
  renderPage();

  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
});
