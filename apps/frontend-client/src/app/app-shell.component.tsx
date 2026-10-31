import { Alert, Anchor, AppShell, Button, Container, Group, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router';

import { useLogout, useMe, useResendVerification } from '../features/auth/use-me.hook.js';
import { ColorSchemeControl } from './color-scheme.component.js';
import { LanguageControl } from './language.component.js';

export function ClientShell(): ReactElement {
  const { t } = useTranslation();
  const me = useMe();
  const logout = useLogout();
  const resend = useResendVerification();
  const navigate = useNavigate();

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>
            <Anchor component={Link} to="/" c="inherit" underline="never">
              {t('shell.title')}
            </Anchor>
          </Title>
          <Group>
            <LanguageControl />
            <ColorSchemeControl />
            <Text size="sm">{me.data?.email}</Text>
            <Button
              size="xs"
              variant="default"
              loading={logout.isPending}
              onClick={(): void => {
                logout.mutate(undefined, { onSuccess: (): void => void navigate('/login') });
              }}
            >
              {t('common.logOut')}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="lg">
          {me.data?.emailVerified === false && (
            <Alert color="yellow" mb="md" title={t('shell.confirmTitle')}>
              <Group>
                <Text size="sm">{t('shell.confirmText', { email: me.data.email })}</Text>
                <Button
                  size="xs"
                  variant="light"
                  loading={resend.isPending}
                  disabled={resend.isSuccess}
                  onClick={(): void => {
                    resend.mutate();
                  }}
                >
                  {resend.isSuccess ? t('shell.sent') : t('shell.sendAgain')}
                </Button>
              </Group>
            </Alert>
          )}
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
