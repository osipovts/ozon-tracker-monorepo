import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';

import { ProtectedRoute } from './protected-route.component.js';

function answerMe(status: number, user?: { email: string; isAdmin: boolean }): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((): Promise<Response> =>
      Promise.resolve(
        Response.json(
          user === undefined
            ? { message: 'no' }
            : { user: { id: 'u', emailVerified: true, ...user } },
          { status },
        ),
      ),
    ),
  );
}

function renderPanel(): ReactElement {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>login page</p> },
      { element: <ProtectedRoute />, children: [{ index: true, element: <p>panel</p> }] },
    ],
    { initialEntries: ['/'] },
  );

  return (
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>
  );
}

test('nobody signed in is sent to log in', async (): Promise<void> => {
  answerMe(401);
  render(renderPanel());

  expect(await screen.findByText('login page')).toBeInTheDocument();
});

test('a user who is no administrator is told the panel is not theirs', async (): Promise<void> => {
  answerMe(200, { email: 'jane@example.com', isAdmin: false });
  render(renderPanel());

  expect(await screen.findByText('No access')).toBeInTheDocument();
  expect(screen.queryByText('panel')).not.toBeInTheDocument();
});

test('an administrator gets the panel', async (): Promise<void> => {
  answerMe(200, { email: 'root@example.com', isAdmin: true });
  render(renderPanel());

  expect(await screen.findByText('panel')).toBeInTheDocument();
});
