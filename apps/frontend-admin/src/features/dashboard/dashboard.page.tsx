import { Badge, Card, Group, Loader, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { useLocale } from '../../i18n/use-locale.hook.js';
import { ErrorAlert } from '../../shared/api/error-alert.component.js';
import { useDashboard } from './use-dashboard.hook.js';

function Stat({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note?: string;
}): ReactElement {
  return (
    <Card withBorder>
      <Text size="sm" c="dimmed">
        {title}
      </Text>
      <Title order={2}>{value}</Title>
      {note !== undefined && (
        <Text size="xs" c="dimmed">
          {note}
        </Text>
      )}
    </Card>
  );
}

export function DashboardPage(): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const dashboard = useDashboard();
  const data = dashboard.data;

  if (dashboard.isError) return <ErrorAlert error={dashboard.error} />;
  if (data === undefined) return <Loader />;

  const { users, products, proxies, sessions, jobs } = data;
  const counts = jobs.lastDay;

  return (
    <Stack>
      <Title order={2}>{t('dashboard.title')}</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Stat
          title={t('dashboard.users')}
          value={String(users.total)}
          note={t('dashboard.usersNote', {
            verified: users.verified,
            joined: users.joinedLastDay,
          })}
        />
        <Stat
          title={t('dashboard.products')}
          value={String(products.products)}
          note={t('dashboard.productsNote', { trackings: products.trackings })}
        />
        <Stat
          title={t('dashboard.proxiesAlive')}
          value={`${String(proxies.alive)} / ${String(proxies.total)}`}
          note={t('dashboard.proxiesNote', { disabled: proxies.disabled })}
        />
        <Stat
          title={t('dashboard.sessions')}
          value={String(sessions.active)}
          note={t('dashboard.sessionsNote', { stale: sessions.stale })}
        />
      </SimpleGrid>
      <Card withBorder>
        <Title order={4} mb="xs">
          {t('dashboard.jobsTitle')}
        </Title>
        <Group>
          <Badge color="gray">{t('dashboard.queued', { count: counts.queued })}</Badge>
          <Badge color="blue">{t('dashboard.running', { count: counts.running })}</Badge>
          <Badge color="yellow">{t('dashboard.retrying', { count: counts.retrying })}</Badge>
          <Badge color="green">{t('dashboard.completed', { count: counts.completed })}</Badge>
          <Badge color="red">{t('dashboard.failed', { count: counts.failed })}</Badge>
        </Group>
      </Card>
      <Card withBorder>
        <Title order={4} mb="xs">
          {t('dashboard.failuresTitle')}
        </Title>
        {jobs.recentFailures.length === 0 ? (
          <Text c="dimmed">{t('dashboard.none')}</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('dashboard.kind')}</Table.Th>
                <Table.Th>{t('dashboard.subject')}</Table.Th>
                <Table.Th>{t('dashboard.error')}</Table.Th>
                <Table.Th>{t('dashboard.finished')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.recentFailures.map((job): ReactElement => (
                <Table.Tr key={job.id}>
                  <Table.Td>{job.kind}</Table.Td>
                  <Table.Td>{job.subject}</Table.Td>
                  <Table.Td>{job.error ?? '-'}</Table.Td>
                  <Table.Td>
                    {job.finishedAt === null
                      ? '-'
                      : new Date(job.finishedAt).toLocaleString(locale)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
