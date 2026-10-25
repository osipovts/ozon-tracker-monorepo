import type { MarketplaceType } from 'product-reference';

import type { TrackedProductEntity } from '../../domain/product/tracked-product.entity.js';
import type { PageInterface, PaginationInterface } from '../shared/page.interface.js';

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
  findById(id: string): Promise<TrackedProductEntity | null>;
  /** Newest first. */
  list(pagination: PaginationInterface): Promise<PageInterface<TrackedProductEntity>>;
  markChecked(id: string, status: string, checkedAt: Date): Promise<void>;
}
