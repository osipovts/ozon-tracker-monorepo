import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';

import { LoginPage } from './login.page.js';

const admin = { id: 'u', email: 'boss@example.com', emailVerified: true, isAdmin: true };

/** A hub where nobody is signed in until the login is accepted; `login` is its answer to it. */
function stubHub(login: Response): void {
  let signedIn = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request): Promise<Response> => {
      const { pathname } = new URL(request.url);
      if (pathname === '/auth/login') {
        signedIn = login.ok;

        return Promise.resolve(login.clone());
      }
      if (pathname === '/auth/me' && signedIn)
        return Promise.resolve(Response.json({ user: admin }));

      return Promise.resolve(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    }),
  );
}

function openLogin(): void {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <p>Dashboard</p> },
    ],
    { initialEntries: ['/login'] },
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

async function submit(): Promise<void> {
  await userEvent.type(await screen.findByLabelText(/Email/), 'boss@example.com');
  await userEvent.type(screen.getByLabelText(/Password/), 'secret-pass');
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

test('logs in and goes to the dashboard', async () => {
  stubHub(Response.json({ user: admin }));
  openLogin();

  await submit();

  expect(await screen.findByText('Dashboard')).toBeInTheDocument();
});

test('says the email or the password is wrong, and stays on the page', async () => {
  stubHub(Response.json({ message: 'Invalid credentials' }, { status: 401 }));
  openLogin();

  await submit();

  expect(await screen.findByRole('alert')).toHaveTextContent('The email or the password is wrong.');
  expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
});
