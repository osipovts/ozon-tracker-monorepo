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
  Tooltip,
} from '@mantine/core';
import type { TFunction } from 'i18next';
import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLocale } from '../../i18n/use-locale.hook.js';
import { ErrorAlert } from '../../shared/api/error-alert.component.js';
import {
  proxyPageSize,
  sessionMarketplace,
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

/** The status of a job as the hub names it; one it does not know is shown as it is. */
function jobStatusLabel(status: string, t: TFunction): string {
  switch (status) {
    case 'queued':
      return t('proxies.jobStatus.queued');
    case 'running':
      return t('proxies.jobStatus.running');
    case 'retrying':
      return t('proxies.jobStatus.retrying');
    case 'completed':
      return t('proxies.jobStatus.completed');
    case 'failed':
      return t('proxies.jobStatus.failed');
    default:
      return status;
  }
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
  const { t } = useTranslation();

  return (
    <Stack gap={4}>
      <Text size="sm">{label}</Text>
      <SegmentedControl
        aria-label={label}
        value={value}
        data={[
          { value: 'all', label: t('common.all') },
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
  const { t } = useTranslation();
  const refresh = useRefreshSource();
  const running =
    refresh.jobId !== null && refresh.status !== 'completed' && refresh.status !== 'failed';

  return (
    <Stack gap={4}>
      <Group>
        <Button loading={refresh.isStarting || running} onClick={refresh.start}>
          {t('proxies.refreshSource')}
        </Button>
        {refresh.status !== null && <Badge>{jobStatusLabel(refresh.status, t)}</Badge>}
      </Group>
      {running && refresh.percent !== null && (
        <Progress.Root size="xl" aria-label={t('proxies.refreshProgress')}>
          <Progress.Section value={refresh.percent}>
            <Progress.Label>{`${String(refresh.percent)}%`}</Progress.Label>
          </Progress.Section>
        </Progress.Root>
      )}
      {refresh.error !== null && <ErrorAlert error={refresh.error} />}
    </Stack>
  );
}

function SessionBadge({
  session,
}: {
  session: { status: 'active' | 'stale'; staleReason: string | null } | null;
}): ReactElement {
  const { t } = useTranslation();

  if (session === null) {
    return (
      <Tooltip multiline w={260} label={t('proxies.sessionNoneHint')}>
        <Badge color="gray">{t('proxies.sessionNone')}</Badge>
      </Tooltip>
    );
  }
  if (session.status === 'active') {
    return (
      <Tooltip multiline w={260} label={t('proxies.sessionActiveHint')}>
        <Badge color="green">{t('proxies.sessionActive')}</Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      multiline
      w={260}
      label={t('proxies.sessionStaleHint', { reason: session.staleReason ?? '-' })}
    >
      <Badge color="orange">{t('proxies.sessionStale')}</Badge>
    </Tooltip>
  );
}

export function ProxiesPage(): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const [alive, setAlive] = useState<ChoiceType>('all');
  const [disabled, setDisabled] = useState<ChoiceType>('all');
  const [ready, setReady] = useState<ChoiceType>('all');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const proxies = useProxies({
    alive: toFilter(alive),
    disabled: toFilter(disabled),
    ready: toFilter(ready),
    page,
  });
  const setProxyDisabled = useSetProxyDisabled();
  const deleteProxy = useDeleteProxy();
  const data = proxies.data;

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <Title order={2}>{t('proxies.title')}</Title>
        <RefreshSource />
      </Group>
      <Group>
        <Choice
          label={t('proxies.filterAlive')}
          value={alive}
          labels={[t('proxies.filterAliveYes'), t('proxies.filterAliveNo')]}
          onChange={(next): void => {
            setAlive(next);
            setPage(1);
          }}
        />
        <Choice
          label={t('proxies.filterOff')}
          value={disabled}
          labels={[t('proxies.filterOffYes'), t('proxies.filterOffNo')]}
          onChange={(next): void => {
            setDisabled(next);
            setPage(1);
          }}
        />
        <Choice
          label={t('proxies.filterSession', { marketplace: sessionMarketplace })}
          value={ready}
          labels={[t('proxies.filterSessionYes'), t('proxies.filterSessionNo')]}
          onChange={(next): void => {
            setReady(next);
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
                <Table.Th>{t('proxies.server')}</Table.Th>
                <Table.Th>{t('proxies.source')}</Table.Th>
                <Table.Th>{t('proxies.country')}</Table.Th>
                <Table.Th>{t('proxies.status')}</Table.Th>
                <Table.Th>{t('proxies.latency')}</Table.Th>
                <Table.Th>{t('proxies.success')}</Table.Th>
                <Table.Th>{t('proxies.checked')}</Table.Th>
                <Table.Th>{t('proxies.session', { marketplace: sessionMarketplace })}</Table.Th>
                <Table.Th>{t('proxies.enabled')}</Table.Th>
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
                    <Tooltip
                      multiline
                      w={260}
                      label={proxy.alive ? t('proxies.aliveHint') : t('proxies.deadHint')}
                    >
                      <Badge color={proxy.alive ? 'green' : 'red'}>
                        {proxy.alive ? t('proxies.alive') : t('proxies.dead')}
                      </Badge>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    {proxy.latencyMs === null
                      ? '-'
                      : t('proxies.milliseconds', { value: proxy.latencyMs })}
                  </Table.Td>
                  <Table.Td>
                    {t('proxies.successOf', {
                      percent: Math.round(proxy.successRate * 100),
                      checks: proxy.checksTotal,
                    })}
                  </Table.Td>
                  <Table.Td>{new Date(proxy.lastCheckedAt).toLocaleString(locale)}</Table.Td>
                  <Table.Td>
                    <SessionBadge session={proxy.session} />
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      aria-label={t('proxies.enabledOf', { server: proxy.server })}
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
                      {t('proxies.delete')}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {data.items.length === 0 && <Text c="dimmed">{t('proxies.noMatch')}</Text>}
          {data.total > proxyPageSize && (
            <Pagination
              total={Math.max(1, Math.ceil(data.total / proxyPageSize))}
              value={page}
              onChange={setPage}
            />
          )}
        </>
      )}
      <Modal
        opened={deleting !== null}
        title={t('proxies.deleteTitle')}
        onClose={(): void => {
          setDeleting(null);
        }}
      >
        <Stack>
          <Text>{t('proxies.deleteText', { server: deleting ?? '' })}</Text>
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
            {t('proxies.delete')}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
