import { Card, Stack, Text, Title } from '@mantine/core';
import { ColorSchemeControl } from 'frontend-shared';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageControl } from '../../app/language.component.js';
import { AccountSection } from './account-section.component.js';
import { DeleteAccountSection } from './delete-account-section.component.js';
import { LinkedAccountsSection } from './linked-accounts-section.component.js';
import { SessionsSection } from './sessions-section.component.js';

/** What a person sets for themselves; the settings are kept by the browser, not by the hub. */
export function SettingsPage(): ReactElement {
  const { t } = useTranslation();

  return (
    <Stack>
      <Title order={2}>{t('settings.title')}</Title>
      <AccountSection />
      <LinkedAccountsSection />
      <SessionsSection />
      <Card withBorder>
        <Stack gap="xs" align="flex-start">
          <Title order={4}>{t('settings.appearance')}</Title>
          <Text size="sm" c="dimmed">
            {t('settings.appearanceHint')}
          </Text>
          <ColorSchemeControl size="sm" />
        </Stack>
      </Card>
      <Card withBorder>
        <Stack gap="xs" align="flex-start">
          <Title order={4}>{t('settings.language')}</Title>
          <Text size="sm" c="dimmed">
            {t('settings.languageHint')}
          </Text>
          <LanguageControl size="sm" />
        </Stack>
      </Card>
      <DeleteAccountSection />
    </Stack>
  );
}
