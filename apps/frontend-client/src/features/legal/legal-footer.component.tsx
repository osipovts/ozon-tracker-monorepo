import { Anchor, Group, Stack, Text } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** The small links to the legal texts, and the version of the app under them, at the foot of every page. */
export function LegalFooter(): ReactElement {
  const { t } = useTranslation();

  return (
    <Stack component="footer" align="center" gap="xs" mt="xl" py="md">
      <Group justify="center" gap="md">
        <Anchor component={Link} to="/privacy" size="xs" c="dimmed">
          {t('legal.privacy')}
        </Anchor>
        <Anchor component={Link} to="/terms" size="xs" c="dimmed">
          {t('legal.terms')}
        </Anchor>
      </Group>
      <Text size="xs" c="dimmed">
        v{APP_VERSION}
      </Text>
    </Stack>
  );
}
