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
import { BRAND_FONT } from './ayu.theme.js';

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
    <AppShell header={{ height: 64 }} padding="md" withBorder={false}>
      <AppShell.Header px="md" pt={10}>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Title order={4} ff={BRAND_FONT} fz={48} fw={400} lh={1}>
              <Anchor
                component={Link}
                to="/"
                c="inherit"
                fz="inherit"
                lh="inherit"
                underline="never"
              >
                {t('shell.title')}
              </Anchor>
            </Title>
            {/* The email, the settings and the way out are one menu: the header stays one line on a phone. */}
            <Menu position="bottom-end" width={260} shadow="md">
              <Menu.Target>
                <Button size="xs" variant="default" rightSection={<ChevronDown />}>
                  {t('shell.account')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label mb="xs" style={{ overflowWrap: 'anywhere' }}>
                  {me.data?.email}
                </Menu.Label>
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
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="lg">
          {me.data?.emailVerified === false && (
            <Alert color="blue" mb="md" title={t('shell.confirmTitle')}>
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
