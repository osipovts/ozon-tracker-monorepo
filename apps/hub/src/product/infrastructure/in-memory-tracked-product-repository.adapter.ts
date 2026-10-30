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
  /** In the order of subscribing: the newest subscription is the last one. */
  private readonly subscriptions: Array<{ userId: string; productId: string }> = [];

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

  subscribe(userId: string, productId: string): Promise<boolean> {
    const subscribed = this.subscribed(userId, productId);
    if (!subscribed) this.subscriptions.push({ userId, productId });

    return Promise.resolve(!subscribed);
  }

  findSubscribed(userId: string, productId: string): Promise<TrackedProductEntity | null> {
    return Promise.resolve(
      this.subscribed(userId, productId) ? (this.products.get(productId) ?? null) : null,
    );
  }

  listSubscribed(
    userId: string,
    pagination: PaginationInterface,
  ): Promise<PageInterface<TrackedProductEntity>> {
    const own = this.subscriptions
      .filter((subscription): boolean => subscription.userId === userId)
      .flatMap(({ productId }): TrackedProductEntity[] => {
        const product = this.products.get(productId);

        return product === undefined ? [] : [product];
      });

    return Promise.resolve(pageOf(own.toReversed(), pagination));
  }

  findById(id: string): Promise<TrackedProductEntity | null> {
    return Promise.resolve(this.products.get(id) ?? null);
  }

  private subscribed(userId: string, productId: string): boolean {
    return this.subscriptions.some(
      (subscription): boolean =>
        subscription.userId === userId && subscription.productId === productId,
    );
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
