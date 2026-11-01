import type { TFunction } from 'i18next';

import type { PricePointInterface } from './price-series.type.js';
import type { ObservationType } from './use-products.hook.js';

/** The price of an observation: the first the marketplace showed; none when it showed none. */
export function priceOf(observation: ObservationType): number | null {
  return observation.prices[0]?.amountMinor ?? null;
}

export function toPoints(observations: ObservationType[]): PricePointInterface[] {
  return observations.flatMap((observation): PricePointInterface[] => {
    const amountMinor = priceOf(observation);

    return amountMinor === null
      ? []
      : [{ observedAt: new Date(observation.observedAt), amountMinor }];
  });
}

export function availabilityLabel(
  availability: ObservationType['availability'],
  t: TFunction,
): string {
  switch (availability) {
    case 'in_stock':
      return t('product.inStock');
    case 'out_of_stock':
      return t('product.outOfStock');
    case 'unknown':
      return t('product.unknown');
  }
}
