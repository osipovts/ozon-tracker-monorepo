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
  /** When a read of the price was last queued, by a user or by the schedule. */
  lastRequestedAt: Date | null;
}

export class TrackedProductEntity {
  constructor(readonly snapshot: TrackedProductInterface) {}
}
