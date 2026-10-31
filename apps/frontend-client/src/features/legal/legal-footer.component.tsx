import { Anchor, Group } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** The small links to the legal texts, at the foot of every page. */
export function LegalFooter(): ReactElement {
  const { t } = useTranslation();

  return (
    <Group component="footer" justify="center" gap="md" mt="xl" py="md">
      <Anchor component={Link} to="/privacy" size="xs" c="dimmed">
        {t('legal.privacy')}
      </Anchor>
      <Anchor component={Link} to="/terms" size="xs" c="dimmed">
        {t('legal.terms')}
      </Anchor>
    </Group>
  );
}
