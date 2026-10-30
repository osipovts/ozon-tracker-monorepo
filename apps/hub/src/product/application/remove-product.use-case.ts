import { ProductNotFoundError } from './product-not-found.error.js';
import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';

/** Stops tracking a product for a user; the product goes for good with its last tracker. */
export class RemoveProductUseCase {
  constructor(private readonly products: TrackedProductRepositoryPort) {}

  async execute(userId: string, productId: string): Promise<void> {
    if (!(await this.products.unsubscribe(userId, productId))) {
      throw new ProductNotFoundError(productId);
    }
  }
}
