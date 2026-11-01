import { Card, Text } from '@mantine/core';
import { useLocale } from 'frontend-shared';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { type ChartRowInterface, titleOf } from './chart-rows.type.js';
import { formatPrice } from './price-format.type.js';
import type { GranularityType } from './price-series.type.js';

export function PriceTooltip({
  row,
  granularity,
}: {
  row: ChartRowInterface;
  granularity: GranularityType;
}): ReactElement {
  const { t } = useTranslation();
  const locale = useLocale();
  const { bucket } = row;

  return (
    <Card withBorder padding="xs" shadow="sm">
      <Text size="sm" fw={600}>
        {titleOf(bucket.start, granularity, locale)}
      </Text>
      {bucket.value === null && <Text size="sm">{t('chart.noPriceYet')}</Text>}
      {bucket.value !== null && !bucket.observed && (
        <Text size="sm">{t('chart.lastKnown', { price: formatPrice(bucket.value) })}</Text>
      )}
      {bucket.observed &&
        bucket.average !== null &&
        bucket.min !== null &&
        bucket.max !== null &&
        bucket.last !== null && (
          <>
            <Text size="sm">{t('chart.average', { price: formatPrice(bucket.average) })}</Text>
            <Text size="sm">{t('chart.min', { price: formatPrice(bucket.min) })}</Text>
            <Text size="sm">{t('chart.max', { price: formatPrice(bucket.max) })}</Text>
            <Text size="sm">{t('chart.last', { price: formatPrice(bucket.last) })}</Text>
          </>
        )}
    </Card>
  );
}
