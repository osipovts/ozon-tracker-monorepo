import type {
  PageInterface,
  PaginationInterface,
} from '../../shared/application/page.interface.js';
import type { PriceObservationInterface } from '../domain/price-observation.interface.js';
import type { TrackedProductEntity } from '../domain/tracked-product.entity.js';
import type { PriceObservationRepositoryPort } from './price-observation-repository.port.js';
import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';

export interface ProductWithLatestInterface {
  product: TrackedProductEntity;
  /** The newest price observation, null until the first one is recorded. */
  latest: PriceObservationInterface | null;
}

export class ListProductsUseCase {
  constructor(
    private readonly products: TrackedProductRepositoryPort,
    private readonly observations: PriceObservationRepositoryPort,
  ) {}

  async execute(
    userId: string,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProductWithLatestInterface>> {
    const page = await this.products.listSubscribed(userId, pagination);
    const latest = new Map(
      (
        await this.observations.findLatestByProducts(
          page.items.map((product): string => product.snapshot.id),
        )
      ).map((observation): [string, PriceObservationInterface] => [
        observation.trackedProductId,
        observation,
      ]),
    );

    return {
      items: page.items.map((product): ProductWithLatestInterface => ({
        product,
        latest: latest.get(product.snapshot.id) ?? null,
      })),
      total: page.total,
    };
  }
}
