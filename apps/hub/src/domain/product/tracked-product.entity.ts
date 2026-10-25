import type { MarketplaceType } from 'product-reference';

export interface TrackedProductInterface {
  id: string;
  marketplace: MarketplaceType;
  externalId: string;
  /** Canonical product URL. */
  url: string;
  /** Status of the last fetch, including failed ones. */
  lastStatus: string | null;
  lastCheckedAt: Date | null;
}

export class TrackedProductEntity {
  constructor(readonly snapshot: TrackedProductInterface) {}
}
