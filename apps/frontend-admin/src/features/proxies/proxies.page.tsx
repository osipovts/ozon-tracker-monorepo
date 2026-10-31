import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Pagination,
  Progress,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { type ReactElement, useState } from 'react';

import { ErrorAlert } from '../../shared/api/error-alert.component.js';
import {
  proxyPageSize,
  useDeleteProxy,
  useProxies,
  useRefreshSource,
  useSetProxyDisabled,
} from './use-proxies.hook.js';

type ChoiceType = 'all' | 'true' | 'false';

function toFilter(choice: ChoiceType): 'true' | 'false' | undefined {
  return choice === 'all' ? undefined : choice;
}

function isChoice(value: string): value is ChoiceType {
  return value === 'all' || value === 'true' || value === 'false';
}

function Choice({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: ChoiceType;
  labels: [string, string];
  onChange: (value: ChoiceType) => void;
}): ReactElement {
  return (
    <Stack gap={4}>
      <Text size="sm">{label}</Text>
      <SegmentedControl
        aria-label={label}
        value={value}
        data={[
          { value: 'all', label: 'All' },
          { value: 'true', label: labels[0] },
          { value: 'false', label: labels[1] },
        ]}
        onChange={(next): void => {
          if (isChoice(next)) onChange(next);
        }}
      />
    </Stack>
  );
}

function RefreshSource(): ReactElement {
  const refresh = useRefreshSource();
  const running =
    refresh.jobId !== null && refresh.status !== 'completed' && refresh.status !== 'failed';

  return (
    <Stack gap={4}>
      <Group>
        <Button loading={refresh.isStarting || running} onClick={refresh.start}>
          Refresh source
        </Button>
        {refresh.status !== null && <Badge>{refresh.status}</Badge>}
      </Group>
      {running && refresh.percent !== null && <Progress value={refresh.percent} />}
      {refresh.error !== null && <ErrorAlert error={refresh.error} />}
    </Stack>
  );
}

export function ProxiesPage(): ReactElement {
  const [alive, setAlive] = useState<ChoiceType>('all');
  const [disabled, setDisabled] = useState<ChoiceType>('all');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const proxies = useProxies({ alive: toFilter(alive), disabled: toFilter(disabled), page });
  const setProxyDisabled = useSetProxyDisabled();
  const deleteProxy = useDeleteProxy();
  const data = proxies.data;

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <Title order={2}>Proxies</Title>
        <RefreshSource />
      </Group>
      <Group>
        <Choice
          label="Alive"
          value={alive}
          labels={['Alive', 'Dead']}
          onChange={(next): void => {
            setAlive(next);
            setPage(1);
          }}
        />
        <Choice
          label="Turned off"
          value={disabled}
          labels={['Off', 'On']}
          onChange={(next): void => {
            setDisabled(next);
            setPage(1);
          }}
        />
      </Group>
      {proxies.isError && <ErrorAlert error={proxies.error} />}
      {setProxyDisabled.error !== null && <ErrorAlert error={setProxyDisabled.error} />}
      {data === undefined ? (
        !proxies.isError && <Loader />
      ) : (
        <>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Server</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Country</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Latency</Table.Th>
                <Table.Th>Success</Table.Th>
                <Table.Th>Enabled</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((proxy): ReactElement => (
                <Table.Tr key={proxy.server}>
                  <Table.Td>{proxy.server}</Table.Td>
                  <Table.Td>{proxy.source}</Table.Td>
                  <Table.Td>{proxy.country ?? '-'}</Table.Td>
                  <Table.Td>
                    <Badge color={proxy.alive ? 'green' : 'red'}>
                      {proxy.alive ? 'alive' : 'dead'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {proxy.latencyMs === null ? '-' : `${String(proxy.latencyMs)} ms`}
                  </Table.Td>
                  <Table.Td>{`${String(Math.round(proxy.successRate * 100))}%`}</Table.Td>
                  <Table.Td>
                    <Switch
                      aria-label={`Enabled ${proxy.server}`}
                      checked={!proxy.disabled}
                      disabled={setProxyDisabled.isPending}
                      onChange={(event): void => {
                        setProxyDisabled.mutate({
                          server: proxy.server,
                          disabled: !event.currentTarget.checked,
                        });
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      onClick={(): void => {
                        setDeleting(proxy.server);
                      }}
                    >
                      Delete
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {data.items.length === 0 && <Text c="dimmed">No proxies match.</Text>}
          <Pagination
            total={Math.max(1, Math.ceil(data.total / proxyPageSize))}
            value={page}
            onChange={setPage}
          />
        </>
      )}
      <Modal
        opened={deleting !== null}
        title="Delete the proxy?"
        onClose={(): void => {
          setDeleting(null);
        }}
      >
        <Stack>
          <Text>
            {deleting} goes from the list. The next refresh of its source finds it again if it is
            still listed there: turn it off instead to keep it away.
          </Text>
          {deleteProxy.error !== null && <ErrorAlert error={deleteProxy.error} />}
          <Button
            color="red"
            loading={deleteProxy.isPending}
            onClick={(): void => {
              if (deleting === null) return;
              deleteProxy.mutate(deleting, {
                onSuccess: (): void => {
                  setDeleting(null);
                },
              });
            }}
          >
            Delete
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
