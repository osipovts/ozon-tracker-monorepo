import { randomUUID } from 'node:crypto';

import {
  type PageInterface,
  pageOf,
  type PaginationInterface,
} from '../../shared/application/page.interface.js';
import type {
  TrackedProductReferenceInterface,
  TrackedProductRepositoryPort,
} from '../application/tracked-product-repository.port.js';
import { TrackedProductEntity } from '../domain/tracked-product.entity.js';

function keyOf(reference: TrackedProductReferenceInterface): string {
  return `${reference.marketplace}/${reference.externalId}`;
}

export class InMemoryTrackedProductRepositoryAdapter implements TrackedProductRepositoryPort {
  private readonly products = new Map<string, TrackedProductEntity>();

  add(
    reference: TrackedProductReferenceInterface,
  ): Promise<{ product: TrackedProductEntity; created: boolean }> {
    const existing = Array.from(this.products.values()).find(
      (product): boolean => keyOf(product.snapshot) === keyOf(reference),
    );
    if (existing !== undefined) return Promise.resolve({ product: existing, created: false });

    const product = new TrackedProductEntity({
      id: randomUUID(),
      ...reference,
      lastStatus: null,
      lastCheckedAt: null,
    });
    this.products.set(product.snapshot.id, product);

    return Promise.resolve({ product, created: true });
  }

  list(pagination: PaginationInterface): Promise<PageInterface<TrackedProductEntity>> {
    // A Map keeps the insertion order: the newest product is the last one.
    return Promise.resolve(pageOf(Array.from(this.products.values()).toReversed(), pagination));
  }

  findById(id: string): Promise<TrackedProductEntity | null> {
    return Promise.resolve(this.products.get(id) ?? null);
  }

  markChecked(id: string, status: string, checkedAt: Date): Promise<void> {
    const product = this.products.get(id);
    if (product !== undefined)
      this.products.set(
        id,
        new TrackedProductEntity({
          ...product.snapshot,
          lastStatus: status,
          lastCheckedAt: checkedAt,
        }),
      );

    return Promise.resolve();
  }
}
