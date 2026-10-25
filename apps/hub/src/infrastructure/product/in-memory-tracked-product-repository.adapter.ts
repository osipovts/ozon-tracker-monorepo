import { randomUUID } from 'node:crypto';

import type {
  TrackedProductReferenceInterface,
  TrackedProductRepositoryPort,
} from '../../application/product/tracked-product-repository.port.js';
import type {
  PageInterface,
  PaginationInterface,
} from '../../application/shared/page.interface.js';
import { TrackedProductEntity } from '../../domain/product/tracked-product.entity.js';

export class InMemoryTrackedProductRepositoryAdapter implements TrackedProductRepositoryPort {
  private readonly products = new Map<string, TrackedProductEntity>();

  upsert(reference: TrackedProductReferenceInterface): Promise<TrackedProductEntity> {
    const existing = Array.from(this.products.values()).find(
      (product): boolean =>
        product.marketplace === reference.marketplace &&
        product.externalId === reference.externalId,
    );
    const product = new TrackedProductEntity(
      existing?.id ?? randomUUID(),
      reference.marketplace,
      reference.externalId,
      reference.url,
      existing?.lastStatus ?? null,
      existing?.lastCheckedAt ?? null,
    );
    this.products.set(product.id, product);
    return Promise.resolve(product);
  }

  findByExternalId(marketplace: string, externalId: string): Promise<TrackedProductEntity | null> {
    return Promise.resolve(
      Array.from(this.products.values()).find(
        (product): boolean =>
          product.marketplace === marketplace && product.externalId === externalId,
      ) ?? null,
    );
  }

  list(pagination: PaginationInterface): Promise<PageInterface<TrackedProductEntity>> {
    // A Map keeps the insertion order: the newest product is the last one.
    const all = Array.from(this.products.values()).toReversed();
    const start = (pagination.page - 1) * pagination.pageSize;
    return Promise.resolve({
      items: all.slice(start, start + pagination.pageSize),
      total: all.length,
    });
  }

  findById(id: string): Promise<TrackedProductEntity | null> {
    return Promise.resolve(this.products.get(id) ?? null);
  }

  markChecked(id: string, status: string, checkedAt: Date): Promise<void> {
    const product = this.products.get(id);
    if (product !== undefined)
      this.products.set(
        id,
        new TrackedProductEntity(
          id,
          product.marketplace,
          product.externalId,
          product.url,
          status,
          checkedAt,
        ),
      );
    return Promise.resolve();
  }
}
