import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createI18n } from '../../i18n/i18n.js';
import { PrivacyPolicyPage, TermsOfServicePage } from './legal.page.js';

function open(address: string): void {
  const router = createMemoryRouter(
    [
      { path: '/privacy', element: <PrivacyPolicyPage /> },
      { path: '/terms', element: <TermsOfServicePage /> },
      { path: '/', element: <p>the app</p> },
    ],
    { initialEntries: [address] },
  );
  render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  );
}

beforeEach((): void => {
  localStorage.clear();
  createI18n('en');
});

test('the privacy policy says what is kept, with Google Limited Use, and links to the other text', () => {
  open('/privacy');

  expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'What data we keep' })).toBeInTheDocument();
  expect(screen.getByText(/Limited Use requirements/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
  expect(screen.getByRole('link', { name: 'Back to the app' })).toHaveAttribute('href', '/');
});

test('the terms say that the prices are not guaranteed', () => {
  open('/terms');

  expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Prices are not guaranteed' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
});

test('the foot of the page shows the version of the app under the links', () => {
  open('/terms');

  const footer = screen.getByRole('contentinfo');
  expect(footer).toHaveTextContent(`v${APP_VERSION}`);
  expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});

test('they are in Russian for a Russian interface', () => {
  createI18n('ru');
  open('/privacy');

  expect(
    screen.getByRole('heading', { level: 1, name: 'Политика конфиденциальности' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Условия использования' })).toHaveAttribute(
    'href',
    '/terms',
  );
});
