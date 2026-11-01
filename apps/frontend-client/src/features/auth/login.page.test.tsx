import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test, vi } from 'vitest';

import { LoginPage } from './login.page.js';

const user = { id: 'u', email: 'jane@example.com', emailVerified: false, isAdmin: false };

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
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <p>Products</p> },
    ],
    { initialEntries: [address] },
  );
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

test('finishes the confirmation of the email after the login, when the hub sends the user here from the link of the mail', async (): Promise<void> => {
  const asked: string[] = [];
  let signedIn = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request): Promise<Response> => {
      const { pathname, search } = new URL(request.url);
      asked.push(`${request.method} ${pathname}${search}`);
      if (pathname === '/auth/oauth/providers')
        return Promise.resolve(Response.json({ providers: [] }));
      if (pathname === '/auth/login') {
        signedIn = true;

        return Promise.resolve(Response.json({ user }));
      }
      if (pathname === '/auth/verify-email')
        return Promise.resolve(Response.json({ verified: true }));
      if (pathname === '/auth/me' && signedIn) return Promise.resolve(Response.json({ user }));

      return Promise.resolve(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    }),
  );
  openLogin('/login?verify=abc-123');

  expect(await screen.findByText('Log in to confirm your email.')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/Email/), 'jane@example.com');
  await userEvent.type(screen.getByLabelText(/Password/), 'secret-pass');
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

  expect(await screen.findByText('Products')).toBeInTheDocument();
  await waitFor((): void => {
    expect(asked).toContain('GET /auth/verify-email?token=abc-123');
  });
});

test('says nothing of a confirmation when the user did not come from the link of the mail', async (): Promise<void> => {
  stubHub([]);
  openLogin();

  await screen.findByRole('button', { name: 'Log in' });
  expect(screen.queryByText('Log in to confirm your email.')).not.toBeInTheDocument();
});

/** A hub that refuses every login with the given answer. */
function refuseLogins(answer: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request): Promise<Response> => {
      const { pathname } = new URL(request.url);
      if (pathname === '/auth/oauth/providers') {
        return Promise.resolve(Response.json({ providers: [] }));
      }
      if (pathname === '/auth/login') return Promise.resolve(answer.clone());

      return Promise.resolve(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    }),
  );
}

async function submitLogin(): Promise<void> {
  await userEvent.type(await screen.findByLabelText(/Email/), 'jane@example.com');
  await userEvent.type(screen.getByLabelText(/Password/), 'secret-pass');
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

test('tells a wrong email or password in its own words, not in those of the hub', async (): Promise<void> => {
  refuseLogins(Response.json({ message: 'Invalid credentials' }, { status: 401 }));
  openLogin();

  await submitLogin();

  expect(await screen.findByRole('alert')).toHaveTextContent('The email or the password is wrong.');
});

test('tells to wait when the hub says there were too many attempts, and for how long', async (): Promise<void> => {
  refuseLogins(
    Response.json({ message: 'Slow down' }, { status: 429, headers: { 'retry-after': '90' } }),
  );
  openLogin();

  await submitLogin();

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Too many attempts. Try again in 90 s.',
  );
});

test('says the hub could not be reached when the request does not get there', async (): Promise<void> => {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request): Promise<Response> =>
      new URL(request.url).pathname === '/auth/oauth/providers'
        ? Promise.resolve(Response.json({ providers: [] }))
        : Promise.reject(new TypeError('Failed to fetch')),
    ),
  );
  openLogin();

  await submitLogin();

  expect(await screen.findByRole('alert')).toHaveTextContent('The hub could not be reached.');
});

test('signs a visitor up and logs them in right after, since signing up starts no session', async () => {
  const asked: string[] = [];
  let signedIn = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request): Promise<Response> => {
      const { pathname } = new URL(request.url);
      asked.push(`${request.method} ${pathname}`);
      if (pathname === '/auth/oauth/providers')
        return Promise.resolve(Response.json({ providers: [] }));
      if (pathname === '/auth/register')
        return Promise.resolve(Response.json({ accepted: true }, { status: 202 }));
      if (pathname === '/auth/login') {
        signedIn = true;

        return Promise.resolve(Response.json({ user }));
      }
      if (pathname === '/auth/me' && signedIn) return Promise.resolve(Response.json({ user }));

      return Promise.resolve(Response.json({ message: 'Unauthorized' }, { status: 401 }));
    }),
  );
  openLogin();

  await userEvent.click(await screen.findByRole('tab', { name: 'Sign up' }));
  await userEvent.type(screen.getByLabelText(/Email/), 'jane@example.com');
  await userEvent.type(screen.getByLabelText(/Password/), 'secret-pass');
  await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

  expect(await screen.findByText('Products')).toBeInTheDocument();
  expect(asked.filter((call) => call.startsWith('POST'))).toEqual([
    'POST /auth/register',
    'POST /auth/login',
  ]);
});
