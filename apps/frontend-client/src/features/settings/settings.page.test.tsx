import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createI18n } from '../../i18n/i18n.js';
import { SettingsPage } from './settings.page.js';

function openSettings(): void {
  render(
    <MantineProvider defaultColorScheme="auto">
      <SettingsPage />
    </MantineProvider>,
  );
}

beforeEach((): void => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ru-RU', 'en-US']);
  localStorage.clear();
  createI18n('en');
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
