import {
  Anchor,
  Badge,
  Group,
  Loader,
  Pagination,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { ApiError, ErrorAlert, useLocale } from 'frontend-shared';
import { type ReactElement, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { isHttpLink } from './http-link.type.js';
import { formatMoment } from './moment-format.type.js';
import { describeNextCheck } from './next-check.type.js';
import { availabilityLabel, priceOf, toPoints } from './observation.type.js';
import { PriceChart } from './price-chart.component.js';
import { formatPrice } from './price-format.type.js';
import { buildPriceSeries, type GranularityType } from './price-series.type.js';
import { ProductThumbnail } from './product-thumbnail.component.js';
import { type ProductHistoryType, usePriceHistory } from './use-products.hook.js';

/** The hours the first chart shows, and the days the second. */
const hoursShown = 48;
const daysShown = 30;
const tablePageSize = 20;

/** The picture, the title, the newest price and the link to the marketplace. */
function ProductHeader({ data }: { data: ProductHistoryType }): ReactElement {
  const { t } = useTranslation();
  const [newest] = data.observations;
  const newestPrice = newest === undefined ? null : priceOf(newest);
  const title = newest?.title ?? `${data.product.marketplace} ${data.product.externalId}`;

  return (
    <Group wrap="nowrap" align="flex-start" gap="md">
      <ProductThumbnail url={data.product.thumbnailUrl} alt={title} size={112} />
      <Stack gap="xs" flex={1} miw={0}>
        <Title order={2} fz={{ base: 20, sm: 28 }}>
          {title}
        </Title>
        <Group gap="sm">
          <Title order={3}>
            {newestPrice === null ? t('product.noPriceYet') : formatPrice(newestPrice)}
          </Title>
          {newest !== undefined && <Badge>{availabilityLabel(newest.availability, t)}</Badge>}
          {data.product.cityName !== null && (
            <Badge variant="light">{t('products.cityOf', { name: data.product.cityName })}</Badge>
          )}
          {isHttpLink(data.product.url) && (
            <Anchor href={data.product.url} target="_blank" rel="noreferrer noopener" size="sm">
              {t('product.openOn', { marketplace: data.product.marketplace })}
            </Anchor>
          )}
        </Group>
      </Stack>
    </Group>
  );
}

/** All the observations, a page of them at a time. */
function HistoryTable({
  observations,
}: {
  observations: ProductHistoryType['observations'];
}): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const rows = observations.slice((page - 1) * tablePageSize, page * tablePageSize);

  return (
    <>
      <Title order={4}>{t('product.history')}</Title>
      <Table.ScrollContainer minWidth={300}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('product.observed')}</Table.Th>
              <Table.Th>{t('product.price')}</Table.Th>
              <Table.Th>{t('product.availability')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((observation): ReactElement => {
              const amountMinor = priceOf(observation);

              return (
                <Table.Tr key={observation.id}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    {formatMoment(observation.observedAt, locale)}
                  </Table.Td>
                  <Table.Td>{amountMinor === null ? '-' : formatPrice(amountMinor)}</Table.Td>
                  <Table.Td>{availabilityLabel(observation.availability, t)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {observations.length === 0 && <Text c="dimmed">{t('product.noHistory')}</Text>}
      {observations.length > tablePageSize && (
        <Pagination
          total={Math.max(1, Math.ceil(observations.length / tablePageSize))}
          value={page}
          onChange={setPage}
        />
      )}
    </>
  );
}

/** The hourly and the daily chart of the prices. */
function PriceCharts({ data }: { data: ProductHistoryType }): ReactElement {
  const { t } = useTranslation();
  const points = useMemo(() => toPoints(data.observations), [data]);
  const series = useMemo((): Record<GranularityType, ReturnType<typeof buildPriceSeries>> => {
    const now = new Date();

    return {
      hour: buildPriceSeries(points, 'hour', hoursShown, now),
      day: buildPriceSeries(points, 'day', daysShown, now),
    };
  }, [points]);

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <PriceChart
        title={t('product.hourlyTitle', { count: hoursShown })}
        granularity="hour"
        buckets={series.hour}
      />
      <PriceChart
        title={t('product.dailyTitle', { count: daysShown })}
        granularity="day"
        buckets={series.day}
      />
    </SimpleGrid>
  );
}

export function ProductPage(): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const { id = '' } = useParams();
  const history = usePriceHistory(id);
  const data = history.data;

  if (history.error instanceof ApiError && history.error.status === 404) {
    return (
      <Stack>
        <Text>{t('product.notTracked')}</Text>
        <Anchor component={Link} to="/">
          {t('common.backToProducts')}
        </Anchor>
      </Stack>
    );
  }
  if (history.isError) return <ErrorAlert error={history.error} />;
  if (data === undefined) return <Loader />;

  const next = describeNextCheck(data.product.nextCheckAt, new Date(), locale);

  return (
    <Stack>
      <Anchor component={Link} to="/" size="sm">
        {t('common.backToProducts')}
      </Anchor>
      <ProductHeader data={data} />
      {next !== null && (
        <Text size="sm" c="dimmed">
          {next.soon ? t('product.nextCheckSoon') : t('product.nextCheck', { when: next.when })}
        </Text>
      )}
      <PriceCharts data={data} />
      <HistoryTable observations={data.observations} />
    </Stack>
  );
}
