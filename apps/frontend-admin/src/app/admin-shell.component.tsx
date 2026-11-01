import { AppShell, Button, Group, NavLink, Text, Title } from '@mantine/core';
import { ColorSchemeControl } from 'frontend-shared';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink as RouterLink, Outlet, useNavigate } from 'react-router';

import { useLogout, useMe } from '../features/auth/use-me.hook.js';
import { LanguageControl } from './language.component.js';

const sections = [
  { to: '/', label: 'shell.dashboard', end: true },
  { to: '/proxies', label: 'shell.proxies', end: false },
  { to: '/handbooks', label: 'shell.handbooks', end: false },
] as const;

export function AdminShell(): ReactElement {
  const { t } = useTranslation();
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 'sm' }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>{t('shell.title')}</Title>
          <Group>
            <LanguageControl />
            <ColorSchemeControl size="xs" />
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
      <AppShell.Navbar p="xs">
        {sections.map((section): ReactElement => (
          <NavLink
            key={section.to}
            component={RouterLink}
            to={section.to}
            end={section.end}
            label={t(section.label)}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
