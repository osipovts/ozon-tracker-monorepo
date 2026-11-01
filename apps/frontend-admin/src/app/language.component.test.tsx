import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { afterEach, expect, test } from 'vitest';

import { createI18n } from '../i18n/i18n.js';
import { LanguageControl } from './language.component.js';

function Greeting(): string {
  return useTranslation().t('login.submit');
}

afterEach(async () => {
  localStorage.clear();
  await createI18n('en').changeLanguage('en');
});

test('switches the language of the interface and keeps the pick for the next visit', async () => {
  render(
    <MantineProvider env="test">
      <LanguageControl />
      <p>
        <Greeting />
      </p>
    </MantineProvider>,
  );
  expect(screen.getByText('Log in')).toBeInTheDocument();

  await userEvent.click(screen.getByText('RU'));

  await waitFor(() => {
    expect(screen.getByText('Войти')).toBeInTheDocument();
  });
  expect(localStorage.getItem('language')).toBe('ru');
});
