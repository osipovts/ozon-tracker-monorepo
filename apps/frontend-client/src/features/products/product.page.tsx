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
import type { TFunction } from 'i18next';
import { type ReactElement, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { useLocale } from '../../i18n/use-locale.hook.js';
import { ApiError } from '../../shared/api/api-error.error.js';
import { ErrorAlert } from '../../shared/api/error-alert.component.js';
import { formatMoment } from './moment-format.type.js';
import { describeNextCheck } from './next-check.type.js';
import { PriceChart } from './price-chart.component.js';
import { formatPrice } from './price-format.type.js';
import {
  buildPriceSeries,
  type GranularityType,
  type PricePointInterface,
} from './price-series.type.js';
import { ProductThumbnail } from './product-thumbnail.component.js';
import { type ObservationType, usePriceHistory } from './use-products.hook.js';

/** The hours the first chart shows, and the days the second. */
const hoursShown = 48;
const daysShown = 30;
const tablePageSize = 20;

/** The price of an observation: the first the marketplace showed; none when it showed none. */
function priceOf(observation: ObservationType): number | null {
  return observation.prices[0]?.amountMinor ?? null;
}

function toPoints(observations: ObservationType[]): PricePointInterface[] {
  return observations.flatMap((observation): PricePointInterface[] => {
    const amountMinor = priceOf(observation);

    return amountMinor === null
      ? []
      : [{ observedAt: new Date(observation.observedAt), amountMinor }];
  });
}

function availabilityLabel(availability: ObservationType['availability'], t: TFunction): string {
  switch (availability) {
    case 'in_stock':
      return t('product.inStock');
    case 'out_of_stock':
      return t('product.outOfStock');
    case 'unknown':
      return t('product.unknown');
  }
}

export function ProductPage(): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const { id = '' } = useParams();
  const history = usePriceHistory(id);
  const [page, setPage] = useState(1);
  const data = history.data;
  const points = useMemo(() => toPoints(data?.observations ?? []), [data]);
  const series = useMemo((): Record<GranularityType, ReturnType<typeof buildPriceSeries>> => {
    const now = new Date();

    return {
      hour: buildPriceSeries(points, 'hour', hoursShown, now),
      day: buildPriceSeries(points, 'day', daysShown, now),
    };
  }, [points]);

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

  const [newest] = data.observations;
  const newestPrice = newest === undefined ? null : priceOf(newest);
  const productTitle = newest?.title ?? `${data.product.marketplace} ${data.product.externalId}`;
  const next = describeNextCheck(data.product.nextCheckAt, new Date(), locale);
  const rows = data.observations.slice((page - 1) * tablePageSize, page * tablePageSize);

  return (
    <Stack>
      <Anchor component={Link} to="/" size="sm">
        {t('common.backToProducts')}
      </Anchor>
      <Group wrap="nowrap" align="flex-start" gap="md">
        <ProductThumbnail url={data.product.thumbnailUrl} alt={productTitle} size={112} />
        <Stack gap="xs" flex={1} miw={0}>
          <Title order={2} fz={{ base: 20, sm: 28 }}>
            {productTitle}
          </Title>
          <Group gap="sm">
            <Title order={3}>
              {newestPrice === null ? t('product.noPriceYet') : formatPrice(newestPrice)}
            </Title>
            {newest !== undefined && <Badge>{availabilityLabel(newest.availability, t)}</Badge>}
            {data.product.cityName !== null && (
              <Badge variant="light">{t('products.cityOf', { name: data.product.cityName })}</Badge>
            )}
            <Anchor href={data.product.url} target="_blank" rel="noreferrer noopener" size="sm">
              {t('product.openOn', { marketplace: data.product.marketplace })}
            </Anchor>
          </Group>
        </Stack>
      </Group>
      {next !== null && (
        <Text size="sm" c="dimmed">
          {next.soon ? t('product.nextCheckSoon') : t('product.nextCheck', { when: next.when })}
        </Text>
      )}
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
      {data.observations.length === 0 && <Text c="dimmed">{t('product.noHistory')}</Text>}
      {data.observations.length > tablePageSize && (
        <Pagination
          total={Math.max(1, Math.ceil(data.observations.length / tablePageSize))}
          value={page}
          onChange={setPage}
        />
      )}
    </Stack>
  );
}
