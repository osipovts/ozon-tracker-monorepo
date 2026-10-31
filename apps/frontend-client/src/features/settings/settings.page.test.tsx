import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createI18n } from '../../i18n/i18n.js';
import { SettingsPage } from './settings.page.js';

const hubCalls: string[] = [];

/** A hub that knows one user, signed in on two devices. */
function stubHub(): void {
  hubCalls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request): Promise<Response> => {
      const { pathname } = new URL(request.url);
      hubCalls.push(`${request.method} ${pathname}`);

      if (pathname === '/auth/me') {
        return Promise.resolve(
          Response.json({
            user: { id: 'u', email: 'jane@example.com', emailVerified: true, isAdmin: false },
          }),
        );
      }
      if (pathname === '/auth/sessions' && request.method === 'GET') {
        const now = new Date().toISOString();
        const base = { ip: '203.0.113.7', createdAt: now, lastSeenAt: now, expiresAt: now };

        return Promise.resolve(
          Response.json({
            sessions: [
              {
                ...base,
                id: '11111111-1111-4111-8111-111111111111',
                current: true,
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36',
              },
              {
                ...base,
                id: '22222222-2222-4222-8222-222222222222',
                current: false,
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1',
              },
            ],
          }),
        );
      }

      return Promise.resolve(new Response(null, { status: 204 }));
    }),
  );
}

function openSettings(): void {
  render(
    <MantineProvider defaultColorScheme="auto">
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <SettingsPage />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

beforeEach((): void => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ru-RU', 'en-US']);
  localStorage.clear();
  createI18n('en');
  stubHub();
});

afterEach((): void => {
  localStorage.clear();
});

test('the theme that is picked is kept by the browser', async (): Promise<void> => {
  openSettings();
  const theme = screen.getByRole('radiogroup', { name: 'Theme' });

  await userEvent.click(within(theme).getByText('Dark'));

  expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
  expect(localStorage.getItem('mantine-color-scheme-value')).toBe('dark');
});

test('the language that is picked is used at once and kept by the browser', async (): Promise<void> => {
  openSettings();
  const language = screen.getByRole('radiogroup', { name: 'Language' });

  await userEvent.click(within(language).getByText('RU'));

  expect(await screen.findByRole('heading', { name: 'Настройки' })).toBeInTheDocument();
  expect(localStorage.getItem('language')).toBe('ru');
});

test('auto forgets the pick and follows the languages of the browser', async (): Promise<void> => {
  localStorage.setItem('language', 'en');
  openSettings();
  const language = screen.getByRole('radiogroup', { name: 'Language' });

  await userEvent.click(within(language).getByText('Auto'));

  // The browser asks for Russian first.
  expect(await screen.findByRole('heading', { name: 'Настройки' })).toBeInTheDocument();
  expect(localStorage.getItem('language')).toBeNull();
});

test('shows who is signed in, and on which devices', async (): Promise<void> => {
  openSettings();

  expect(await screen.findByText('jane@example.com')).toBeInTheDocument();
  expect(screen.getByText('confirmed')).toBeInTheDocument();
  expect(await screen.findByText('Chrome, Linux')).toBeInTheDocument();
  expect(screen.getByText('this device')).toBeInTheDocument();
  expect(screen.getByText('Safari, iPhone')).toBeInTheDocument();
});

test('signs a device out, and all the others at once', async (): Promise<void> => {
  openSettings();
  await screen.findByText('Safari, iPhone');

  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(hubCalls).toContain('DELETE /auth/sessions/22222222-2222-4222-8222-222222222222');

  await userEvent.click(screen.getByRole('button', { name: 'Sign out the other devices' }));
  expect(hubCalls).toContain('DELETE /auth/sessions');
});

test('changes the password with the current one', async (): Promise<void> => {
  openSettings();

  await userEvent.type(await screen.findByLabelText(/Current password/), 'old-password-1');
  await userEvent.type(screen.getByLabelText(/New password/), 'new-password-2');
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

  expect(await screen.findByText('The password is changed.')).toBeInTheDocument();
  expect(hubCalls).toContain('POST /auth/password');
});
