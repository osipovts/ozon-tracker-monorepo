import type { TrackedProductEntity } from '../domain/tracked-product.entity.js';
import type { PageInterface, PaginationInterface } from './page.interface.js';

export const TRACKED_PRODUCT_REPOSITORY = Symbol('TrackedProductRepositoryPort');

export interface TrackedProductReferenceInterface {
  marketplace: string;
  externalId: string;
  url: string;
}

export interface TrackedProductRepositoryPort {
  /** Returns the existing product of the marketplace or creates it. */
  upsert(reference: TrackedProductReferenceInterface): Promise<TrackedProductEntity>;
  findById(id: string): Promise<TrackedProductEntity | null>;
  findByExternalId(marketplace: string, externalId: string): Promise<TrackedProductEntity | null>;
  /** Newest first. */
  list(pagination: PaginationInterface): Promise<PageInterface<TrackedProductEntity>>;
  markChecked(id: string, status: string, checkedAt: Date): Promise<void>;
}
