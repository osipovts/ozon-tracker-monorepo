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
import { type ReactElement, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../shared/api/api-error.error.js';
import { ErrorAlert } from '../../shared/api/error-alert.component.js';
import { PriceChart } from './price-chart.component.js';
import { formatPrice } from './price-format.type.js';
import {
  buildPriceSeries,
  type GranularityType,
  type PricePointInterface,
} from './price-series.type.js';
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

function availabilityLabel(availability: ObservationType['availability']): string {
  switch (availability) {
    case 'in_stock':
      return 'in stock';
    case 'out_of_stock':
      return 'out of stock';
    case 'unknown':
      return 'unknown';
  }
}

export function ProductPage(): ReactElement {
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
        <Text>This product is not tracked.</Text>
        <Anchor component={Link} to="/">
          Back to the products
        </Anchor>
      </Stack>
    );
  }
  if (history.isError) return <ErrorAlert error={history.error} />;
  if (data === undefined) return <Loader />;

  const [newest] = data.observations;
  const newestPrice = newest === undefined ? null : priceOf(newest);
  const rows = data.observations.slice((page - 1) * tablePageSize, page * tablePageSize);

  return (
    <Stack>
      <Anchor component={Link} to="/" size="sm">
        Back to the products
      </Anchor>
      <Title order={2}>
        {newest?.title ?? `${data.product.marketplace} ${data.product.externalId}`}
      </Title>
      <Group>
        <Title order={3}>{newestPrice === null ? 'No price yet' : formatPrice(newestPrice)}</Title>
        {newest !== undefined && <Badge>{availabilityLabel(newest.availability)}</Badge>}
        <Anchor href={data.product.url} target="_blank" rel="noreferrer noopener" size="sm">
          Open on {data.product.marketplace}
        </Anchor>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <PriceChart title="By hour, the last 48 hours" granularity="hour" buckets={series.hour} />
        <PriceChart title="By day, the last 30 days" granularity="day" buckets={series.day} />
      </SimpleGrid>
      <Title order={4}>History</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Observed</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th>Availability</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((observation): ReactElement => {
            const amountMinor = priceOf(observation);

            return (
              <Table.Tr key={observation.id}>
                <Table.Td>{new Date(observation.observedAt).toLocaleString()}</Table.Td>
                <Table.Td>{amountMinor === null ? '-' : formatPrice(amountMinor)}</Table.Td>
                <Table.Td>{availabilityLabel(observation.availability)}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {data.observations.length === 0 && <Text c="dimmed">No prices have been read yet.</Text>}
      <Pagination
        total={Math.max(1, Math.ceil(data.observations.length / tablePageSize))}
        value={page}
        onChange={setPage}
      />
    </Stack>
  );
}
