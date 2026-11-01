import { Card, Title } from '@mantine/core';
import { useLocale } from 'frontend-shared';
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

import { isRow, labelOf, paddedDomain, toRows } from './chart-rows.type.js';
import { formatPriceShort } from './price-format.type.js';
import type { GranularityType, PriceBucketInterface } from './price-series.type.js';
import { PriceTooltip } from './price-tooltip.component.js';

export function PriceChart({
  title,
  granularity,
  buckets,
}: {
  title: string;
  granularity: GranularityType;
  buckets: PriceBucketInterface[];
}): ReactElement {
  const locale = useLocale();
  const rows = toRows(buckets);

  return (
    <Card withBorder>
      <Title order={4} mb="xs">
        {title}
      </Title>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--mantine-color-default-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="key"
            tickFormatter={(key: string): string => labelOf(new Date(key), granularity, locale)}
            stroke="var(--mantine-color-dimmed)"
            tick={{ fontSize: 12 }}
            minTickGap={24}
          />
          <YAxis
            stroke="var(--mantine-color-dimmed)"
            tick={{ fontSize: 12 }}
            width={72}
            domain={paddedDomain(buckets)}
            tickFormatter={(value: number): string => formatPriceShort(value)}
          />
          <Tooltip
            content={(props): ReactElement | null => {
              const row: unknown = props.payload[0]?.payload;

              return props.active && isRow(row) ? (
                <PriceTooltip row={row} granularity={granularity} />
              ) : null;
            }}
          />
          <Line
            dataKey="dashed"
            stroke="var(--mantine-color-yellow-6)"
            strokeDasharray="6 4"
            dot={false}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="solid"
            stroke="var(--mantine-color-yellow-6)"
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
