import type { PriceObservationInterface } from '../../domain/product/price-observation.interface.js';
import type { PageInterface, PaginationInterface } from '../shared/page.interface.js';

export const PRICE_OBSERVATION_REPOSITORY = Symbol('PriceObservationRepositoryPort');

export interface PriceObservationRepositoryPort {
  /** A redelivered result (same job and product) is ignored. */
  saveIfAbsent(observation: PriceObservationInterface): Promise<void>;
  /** The newest observation of each of the products that has one. */
  findLatestByProducts(trackedProductIds: readonly string[]): Promise<PriceObservationInterface[]>;
  /** Newest first. */
  listByProduct(
    trackedProductId: string,
    pagination: PaginationInterface,
  ): Promise<PageInterface<PriceObservationInterface>>;
}
