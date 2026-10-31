import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

import { LoginPage } from './login.page.js';

/** A hub where nobody is signed in, and the given providers are set up. */
function stubHub(providers: string[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request): Promise<Response> => {
      const { pathname } = new URL(request.url);
      if (pathname === '/auth/oauth/providers') {
        return Promise.resolve(Response.json({ providers }));
      }

      return Promise.resolve(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    }),
  );
}

function openLogin(address = '/login'): void {
  const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
    initialEntries: [address],
  });
  render(
    <MantineProvider>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

beforeEach((): void => {
  localStorage.clear();
});

test('offers a login through each provider the hub has set up, as a link to the hub', async (): Promise<void> => {
  stubHub(['google', 'github']);
  openLogin();

  const google = await screen.findByRole('link', { name: 'Continue with Google' });
  expect(google).toHaveAttribute('href', '/auth/oauth/google/start');
  expect(screen.getByRole('link', { name: 'Continue with GitHub' })).toHaveAttribute(
    'href',
    '/auth/oauth/github/start',
  );
});

test('offers only the providers that are set up, and no divider when there are none', async (): Promise<void> => {
  stubHub(['github']);
  openLogin();
  expect(await screen.findByRole('link', { name: 'Continue with GitHub' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument();
});

test('shows nothing of providers when none is set up', async (): Promise<void> => {
  stubHub([]);
  openLogin();

  expect(await screen.findByRole('button', { name: 'Log in', hidden: false })).toBeInTheDocument();
  expect(screen.queryByText('or')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Continue with/ })).not.toBeInTheDocument();
});

test('says that the login through a provider failed when the hub sends the user back with an error', async (): Promise<void> => {
  stubHub(['google']);
  openLogin('/login?error=oauth');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The login through the provider failed',
  );
});

test('has the links to the legal texts at its foot', async (): Promise<void> => {
  stubHub([]);
  openLogin();

  expect(await screen.findByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
    'href',
    '/privacy',
  );
  expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
});
