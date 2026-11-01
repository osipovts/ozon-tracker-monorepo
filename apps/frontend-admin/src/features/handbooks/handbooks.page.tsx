import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Pagination,
  Progress,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ErrorAlert, useLocale } from 'frontend-shared';
import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { jobStatusLabel } from '../jobs/job-status-label.type.js';
import {
  type HandbookCitiesPageType,
  handbookPageSize,
  useHandbookCities,
  useRefreshHandbook,
} from './use-handbooks.hook.js';

/** When the cities were read, and the button that reads them again with the progress of the read. */
function RefreshBar({ fetchedAt }: { fetchedAt: string | null | undefined }): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const refresh = useRefreshHandbook('dns-cities');

  return (
    <>
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={3}>{t('handbooks.dnsCities')}</Title>
          <Text size="sm" c="dimmed">
            {t('handbooks.dnsCitiesHint')}
          </Text>
          {fetchedAt !== undefined && (
            <Text size="sm">
              {fetchedAt === null
                ? t('handbooks.never')
                : t('handbooks.updated', { when: new Date(fetchedAt).toLocaleString(locale) })}
            </Text>
          )}
        </Stack>
        <Group align="center">
          {refresh.status !== null && <Badge>{jobStatusLabel(refresh.status, t)}</Badge>}
          <Button loading={refresh.isRunning} disabled={refresh.isRunning} onClick={refresh.start}>
            {t('handbooks.refresh')}
          </Button>
        </Group>
      </Group>
      {refresh.isRunning && refresh.percent !== null && (
        <Progress.Root size="xl" aria-label={t('handbooks.progress')}>
          <Progress.Section value={refresh.percent}>
            <Progress.Label>{`${String(refresh.percent)}%`}</Progress.Label>
          </Progress.Section>
        </Progress.Root>
      )}
      {refresh.error !== null && <ErrorAlert error={refresh.error} />}
    </>
  );
}

function CitiesTable({
  data,
  page,
  onPage,
}: {
  data: HandbookCitiesPageType;
  page: number;
  onPage: (page: number) => void;
}): ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <Text size="sm" c="dimmed">
        {t('handbooks.total', { count: data.total })}
      </Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('handbooks.name')}</Table.Th>
            <Table.Th>{t('handbooks.region')}</Table.Th>
            <Table.Th>{t('handbooks.id')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.items.map((city): ReactElement => (
            <Table.Tr key={city.id}>
              <Table.Td>{city.name}</Table.Td>
              <Table.Td>{city.region ?? '-'}</Table.Td>
              <Table.Td>{city.id}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {data.items.length === 0 && <Text c="dimmed">{t('handbooks.none')}</Text>}
      {data.total > handbookPageSize && (
        <Pagination
          total={Math.max(1, Math.ceil(data.total / handbookPageSize))}
          value={page}
          onChange={onPage}
        />
      )}
    </>
  );
}

export function HandbooksPage(): ReactElement {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const cities = useHandbookCities('dns-cities', query, page);

  return (
    <Stack>
      <Title order={2}>{t('handbooks.title')}</Title>
      <Card withBorder>
        <Stack>
          <RefreshBar fetchedAt={cities.data?.fetchedAt} />
          <TextInput
            label={t('handbooks.search')}
            value={query}
            onChange={(event): void => {
              setQuery(event.currentTarget.value);
              setPage(1);
            }}
          />
          {cities.isError && <ErrorAlert error={cities.error} />}
          {cities.data === undefined ? (
            !cities.isError && <Loader />
          ) : (
            <CitiesTable data={cities.data} page={page} onPage={setPage} />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
