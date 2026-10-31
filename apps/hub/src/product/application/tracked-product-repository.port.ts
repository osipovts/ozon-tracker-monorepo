import type { MarketplaceType } from 'product-reference';

import type {
  PageInterface,
  PaginationInterface,
} from '../../shared/application/page.interface.js';
import type { TrackedProductEntity } from '../domain/tracked-product.entity.js';

export const TRACKED_PRODUCT_REPOSITORY = Symbol('TrackedProductRepositoryPort');

export interface TrackedProductReferenceInterface {
  marketplace: MarketplaceType;
  externalId: string;
  url: string;
}

export interface TrackedProductRepositoryPort {
  /** Starts tracking the product unless it is tracked already; tells which one happened. */
  add(
    reference: TrackedProductReferenceInterface,
  ): Promise<{ product: TrackedProductEntity; created: boolean }>;
  /**
   * The user tracks the product from now on; false if they did already. Throws `ProductGoneError`
   * if the last tracker removed the product meanwhile.
   */
  subscribe(userId: string, productId: string): Promise<boolean>;
  /**
   * The user stops tracking the product, which is deleted with its price history when nobody
   * tracks it any more; false if the user did not track it.
   */
  unsubscribe(userId: string, productId: string): Promise<boolean>;
  /** For the workers, which serve every user: a user asks for `findSubscribed` instead. */
  findById(id: string): Promise<TrackedProductEntity | null>;
  /** The product, if the user tracks it. */
  findSubscribed(userId: string, productId: string): Promise<TrackedProductEntity | null>;
  /**
   * The products somebody tracks whose last read and last request are both before the time, the
   * longest waiting first: the ones the schedule reads next.
   */
  listDueForRefresh(before: Date, limit: number): Promise<TrackedProductEntity[]>;
  /** Notes that a read of the products was queued at the time, so that the schedule leaves them be for a while. */
  markRequested(productIds: string[], at: Date): Promise<void>;
  /** How many products there are, and how many times users track them. */
  stats(): Promise<{ products: number; trackings: number }>;
  /** The products of the user, tracked most recently first. */
  listSubscribed(
    userId: string,
    pagination: PaginationInterface,
  ): Promise<PageInterface<TrackedProductEntity>>;
  markChecked(id: string, status: string, checkedAt: Date): Promise<void>;
}
