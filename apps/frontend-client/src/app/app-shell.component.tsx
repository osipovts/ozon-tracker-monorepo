import {
  Alert,
  Anchor,
  AppShell,
  Button,
  Container,
  Group,
  Menu,
  Text,
  Title,
} from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router';

import { useLogout, useMe, useResendVerification } from '../features/auth/use-me.hook.js';
import { LegalFooter } from '../features/legal/legal-footer.component.js';

/** The arrow of a button that opens a menu. */
function ChevronDown(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ClientShell(): ReactElement {
  const { t } = useTranslation();
  const me = useMe();
  const logout = useLogout();
  const resend = useResendVerification();
  const navigate = useNavigate();

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" align="baseline" wrap="nowrap">
            <Title order={4}>
              <Anchor component={Link} to="/" c="inherit" underline="never">
                {t('shell.title')}
              </Anchor>
            </Title>
            <Text size="sm" c="dimmed" visibleFrom="sm">
              {t('brand.slogan')}
            </Text>
          </Group>
          {/* The email, the settings and the way out are one menu: the header stays one line on a phone. */}
          <Menu position="bottom-end" width={260}>
            <Menu.Target>
              <Button size="xs" variant="default" rightSection={<ChevronDown />}>
                {t('shell.account')}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label style={{ overflowWrap: 'anywhere' }}>{me.data?.email}</Menu.Label>
              <Menu.Item component={Link} to="/settings">
                {t('shell.settings')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                disabled={logout.isPending}
                onClick={(): void => {
                  logout.mutate(undefined, { onSuccess: (): void => void navigate('/login') });
                }}
              >
                {t('common.logOut')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
          <LegalFooter />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
