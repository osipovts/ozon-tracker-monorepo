import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';

import { ProtectedRoute } from './protected-route.component.js';

function stubHub(answer: () => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(answer));
}

function open(): void {
  const router = createMemoryRouter(
    [
      { element: <ProtectedRoute />, children: [{ index: true, element: <p>Secret</p> }] },
      { path: '/login', element: <p>Login page</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <MantineProvider env="test">
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

test('lets in whoever is signed in', async () => {
  stubHub(() =>
    Promise.resolve(
      Response.json({ user: { id: 'u', email: 'a@b.c', emailVerified: true, isAdmin: false } }),
    ),
  );
  open();

  expect(await screen.findByText('Secret')).toBeInTheDocument();
});

test('sends a visitor to the login page', async () => {
  stubHub(() => Promise.resolve(Response.json({ message: 'Unauthorized' }, { status: 401 })));
  open();

  expect(await screen.findByText('Login page')).toBeInTheDocument();
  expect(screen.queryByText('Secret')).not.toBeInTheDocument();
});

test('says what went wrong when the hub cannot say who is signed in', async () => {
  stubHub(() => Promise.resolve(Response.json({ message: 'Broken' }, { status: 500 })));
  open();

  expect(await screen.findByRole('alert')).toHaveTextContent('Broken');
});

test('waits, without showing the page, for the answer of the hub', () => {
  stubHub(() => new Promise<Response>(() => undefined));
  open();

  expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  expect(screen.queryByText('Login page')).not.toBeInTheDocument();
});
