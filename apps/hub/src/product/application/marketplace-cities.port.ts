import type { MarketplaceType } from 'product-reference';

export interface MarketplaceCitiesPort {
  /** The city of the marketplace by the id it gives it; null if it has none such. */
  find(marketplace: MarketplaceType, cityId: string): Promise<{ name: string } | null>;
}
