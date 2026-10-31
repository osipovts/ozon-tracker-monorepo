import type { RemoveProductUseCase } from './remove-product.use-case.js';
import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';

/** How many products are taken at a time: a user tracks a few, and the list is read again until it is empty. */
const pageSize = 100;

/**
 * Stops tracking every product of a user, for an account that is deleted: a product nobody tracks any more
 * goes for good, with its price history and its picture, as when the user removes them one by one.
 */
export class RemoveUserProductsUseCase {
  constructor(
    private readonly products: TrackedProductRepositoryPort,
    private readonly remove: Pick<RemoveProductUseCase, 'execute'>,
  ) {}

  async execute(userId: string): Promise<void> {
    for (
      let page = await this.products.listSubscribed(userId, { page: 1, pageSize });
      page.items.length > 0;
      page = await this.products.listSubscribed(userId, { page: 1, pageSize })
    ) {
      for (const { snapshot } of page.items) await this.remove.execute(userId, snapshot.id);
    }
  }
}
