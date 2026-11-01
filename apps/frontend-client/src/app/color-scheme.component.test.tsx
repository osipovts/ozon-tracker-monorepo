import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorSchemeControl } from 'frontend-shared';
import { afterEach, expect, test, vi } from 'vitest';

function systemPrefers(scheme: 'dark' | 'light'): void {
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
    matches: query === '(prefers-color-scheme: dark)' && scheme === 'dark',
    media: query,
    onchange: null,
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
    addListener: (): void => undefined,
    removeListener: (): void => undefined,
    dispatchEvent: (): boolean => false,
  }));
}

function renderControl(): void {
  render(
    <MantineProvider defaultColorScheme="auto">
      <ColorSchemeControl />
    </MantineProvider>,
  );
}

afterEach((): void => {
  localStorage.clear();
});

test('follows the theme of the system until one is picked', async (): Promise<void> => {
  systemPrefers('dark');
  renderControl();

  expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');

  await userEvent.click(screen.getByText('Light'));
  expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light');

  await userEvent.click(screen.getByText('Auto'));
  expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
});

test('takes the light theme of the system as it is', (): void => {
  systemPrefers('light');
  renderControl();

  expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light');
});
