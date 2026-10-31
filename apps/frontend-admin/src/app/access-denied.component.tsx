import { Button, Container, Stack, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { useLogout } from '../features/auth/use-me.hook.js';

/** For a user who is signed in and is no administrator: the panel is not theirs. */
export function AccessDenied({ email }: { email: string }): ReactElement {
  const { t } = useTranslation();
  const logout = useLogout();

  return (
    <Container size="xs" mt={96}>
      <Stack>
        <Title order={2}>{t('denied.title')}</Title>
        <Text>{t('denied.text', { email })}</Text>
        <Button
          variant="default"
          loading={logout.isPending}
          onClick={(): void => {
            logout.mutate();
          }}
        >
          {t('common.logOut')}
        </Button>
      </Stack>
    </Container>
  );
}
