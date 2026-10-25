import type { PriceObservationInterface } from '../../domain/product/price-observation.interface.js';
import type { TrackedProductEntity } from '../../domain/product/tracked-product.entity.js';
import type { PageInterface, PaginationInterface } from '../shared/page.interface.js';
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
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProductWithLatestInterface>> {
    const page = await this.products.list(pagination);
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
