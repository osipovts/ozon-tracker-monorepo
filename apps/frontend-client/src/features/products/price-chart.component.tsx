import { Card, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatPrice } from './price-format.type.js';
import type { GranularityType, PriceBucketInterface } from './price-series.type.js';

interface ChartRowInterface {
  label: string;
  /** Where the bucket has prices: drawn solid. */
  solid: number | null;
  /** Where it has none, and the points beside it: the last known price, drawn dashed. */
  dashed: number | null;
  bucket: PriceBucketInterface;
}

function labelOf(start: Date, granularity: GranularityType): string {
  return granularity === 'hour'
    ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : start.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

function titleOf(start: Date, granularity: GranularityType): string {
  return granularity === 'hour'
    ? start.toLocaleString([], {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : start.toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' });
}

/** A gap is dashed together with the points on both of its sides, so that the line is not broken. */
function toRows(
  buckets: PriceBucketInterface[],
  granularity: GranularityType,
): ChartRowInterface[] {
  return buckets.map((bucket, index): ChartRowInterface => {
    const beside = [buckets[index - 1], buckets[index + 1]];
    const nearGap =
      !bucket.observed || beside.some((other): boolean => other !== undefined && !other.observed);

    return {
      label: labelOf(bucket.start, granularity),
      solid: bucket.observed ? bucket.value : null,
      dashed: nearGap ? bucket.value : null,
      bucket,
    };
  });
}

function isRow(value: unknown): value is ChartRowInterface {
  return typeof value === 'object' && value !== null && 'bucket' in value && 'label' in value;
}

function TooltipBody({
  row,
  granularity,
}: {
  row: ChartRowInterface;
  granularity: GranularityType;
}): ReactElement {
  const { bucket } = row;

  return (
    <Card withBorder padding="xs" shadow="sm">
      <Text size="sm" fw={600}>
        {titleOf(bucket.start, granularity)}
      </Text>
      {bucket.value === null && <Text size="sm">No price yet</Text>}
      {bucket.value !== null && !bucket.observed && (
        <Text size="sm">Last known: {formatPrice(bucket.value)}</Text>
      )}
      {bucket.observed &&
        bucket.average !== null &&
        bucket.min !== null &&
        bucket.max !== null &&
        bucket.last !== null && (
          <>
            <Text size="sm">Average: {formatPrice(bucket.average)}</Text>
            <Text size="sm">Min: {formatPrice(bucket.min)}</Text>
            <Text size="sm">Max: {formatPrice(bucket.max)}</Text>
            <Text size="sm">Last: {formatPrice(bucket.last)}</Text>
          </>
        )}
    </Card>
  );
}

export function PriceChart({
  title,
  granularity,
  buckets,
}: {
  title: string;
  granularity: GranularityType;
  buckets: PriceBucketInterface[];
}): ReactElement {
  const rows = toRows(buckets, granularity);

  return (
    <Card withBorder>
      <Title order={4} mb="xs">
        {title}
      </Title>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--mantine-color-default-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke="var(--mantine-color-dimmed)"
            tick={{ fontSize: 12 }}
            minTickGap={24}
          />
          <YAxis
            stroke="var(--mantine-color-dimmed)"
            tick={{ fontSize: 12 }}
            width={80}
            domain={['auto', 'auto']}
            tickFormatter={(value: number): string => formatPrice(value)}
          />
          <Tooltip
            content={(props): ReactElement | null => {
              const row: unknown = props.payload[0]?.payload;

              return props.active && isRow(row) ? (
                <TooltipBody row={row} granularity={granularity} />
              ) : null;
            }}
          />
          <Line
            dataKey="dashed"
            stroke="var(--mantine-color-blue-6)"
            strokeDasharray="6 4"
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="solid"
            stroke="var(--mantine-color-blue-6)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
