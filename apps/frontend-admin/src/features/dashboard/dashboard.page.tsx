import { Badge, Card, Group, Loader, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';

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
  const dashboard = useDashboard();
  const data = dashboard.data;

  if (dashboard.isError) return <ErrorAlert error={dashboard.error} />;
  if (data === undefined) return <Loader />;

  const { users, products, proxies, sessions, jobs } = data;
  const counts = jobs.lastDay;

  return (
    <Stack>
      <Title order={2}>Dashboard</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Stat
          title="Users"
          value={String(users.total)}
          note={`${String(users.verified)} verified, ${String(users.joinedLastDay)} joined in a day`}
        />
        <Stat
          title="Products"
          value={String(products.products)}
          note={`${String(products.trackings)} trackings`}
        />
        <Stat
          title="Proxies alive"
          value={`${String(proxies.alive)} / ${String(proxies.total)}`}
          note={`${String(proxies.disabled)} turned off`}
        />
        <Stat
          title="Browser sessions"
          value={String(sessions.active)}
          note={`${String(sessions.stale)} stale`}
        />
      </SimpleGrid>
      <Card withBorder>
        <Title order={4} mb="xs">
          Jobs in the last day
        </Title>
        <Group>
          <Badge color="gray">queued {counts.queued}</Badge>
          <Badge color="blue">running {counts.running}</Badge>
          <Badge color="yellow">retrying {counts.retrying}</Badge>
          <Badge color="green">completed {counts.completed}</Badge>
          <Badge color="red">failed {counts.failed}</Badge>
        </Group>
      </Card>
      <Card withBorder>
        <Title order={4} mb="xs">
          Recent failures
        </Title>
        {jobs.recentFailures.length === 0 ? (
          <Text c="dimmed">None.</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kind</Table.Th>
                <Table.Th>Subject</Table.Th>
                <Table.Th>Error</Table.Th>
                <Table.Th>Finished</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.recentFailures.map((job): ReactElement => (
                <Table.Tr key={job.id}>
                  <Table.Td>{job.kind}</Table.Td>
                  <Table.Td>{job.subject}</Table.Td>
                  <Table.Td>{job.error ?? '-'}</Table.Td>
                  <Table.Td>
                    {job.finishedAt === null ? '-' : new Date(job.finishedAt).toLocaleString()}
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
