import { AppShell, Button, Group, NavLink, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import { NavLink as RouterLink, Outlet, useNavigate } from 'react-router';

import { useLogout, useMe } from '../features/auth/use-me.hook.js';

const sections = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/proxies', label: 'Proxies', end: false },
] as const;

export function AdminShell(): ReactElement {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 'sm' }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>Hub admin</Title>
          <Group>
            <Text size="sm">{me.data?.email}</Text>
            <Button
              size="xs"
              variant="default"
              loading={logout.isPending}
              onClick={(): void => {
                logout.mutate(undefined, { onSuccess: (): void => void navigate('/login') });
              }}
            >
              Log out
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
            label={section.label}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
