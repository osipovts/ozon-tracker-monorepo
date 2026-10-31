import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';

export interface ProductStatsInterface {
  products: number;
  /** What users track in all: a product that two of them track counts twice. */
  trackings: number;
}

export class GetProductStatsUseCase {
  constructor(private readonly products: TrackedProductRepositoryPort) {}

  execute(): Promise<ProductStatsInterface> {
    return this.products.stats();
  }
}
