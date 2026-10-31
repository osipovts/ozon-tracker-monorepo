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
  /** The key of the picture of the product in the object storage; null until one is kept. */
  thumbnailKey: string | null;
  /** The address the kept picture was taken from. */
  thumbnailSourceUrl: string | null;
}

export class TrackedProductEntity {
  constructor(readonly snapshot: TrackedProductInterface) {}
}
