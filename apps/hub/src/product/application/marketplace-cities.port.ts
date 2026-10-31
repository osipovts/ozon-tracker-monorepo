import type { MarketplaceType } from 'product-reference';

export interface MarketplaceCitiesPort {
  /** Whether the marketplace has the city, by the id it gives it. */
  exists(marketplace: MarketplaceType, cityId: string): Promise<boolean>;
}
