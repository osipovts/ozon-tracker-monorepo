import { marketplaces } from 'product-reference';
import { z } from 'zod';

import type {
  PrismaClient,
  TrackedProduct as TrackedProductRow,
} from '../../generated/prisma/client.js';
import {
  type PageInterface,
  pageOffset,
  type PaginationInterface,
} from '../../shared/application/page.interface.js';
import type {
  TrackedProductReferenceInterface,
  TrackedProductRepositoryPort,
} from '../application/tracked-product-repository.port.js';
import { TrackedProductEntity } from '../domain/tracked-product.entity.js';

const marketplaceSchema = z.enum(marketplaces);

function toEntity(row: TrackedProductRow): TrackedProductEntity {
  return new TrackedProductEntity({
    id: row.id,
    marketplace: marketplaceSchema.parse(row.marketplace),
    externalId: row.externalId,
    url: row.url,
    lastStatus: row.lastStatus,
    lastCheckedAt: row.lastCheckedAt,
  });
}

export class PrismaTrackedProductRepositoryAdapter implements TrackedProductRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async add(
    reference: TrackedProductReferenceInterface,
  ): Promise<{ product: TrackedProductEntity; created: boolean }> {
    // Skipping a duplicate instead of reading first keeps concurrent adds of a product apart.
    const { count } = await this.prisma.trackedProduct.createMany({
      data: [reference],
      skipDuplicates: true,
    });
    const row = await this.prisma.trackedProduct.findUniqueOrThrow({
      where: {
        marketplaceExternalId: {
          marketplace: reference.marketplace,
          externalId: reference.externalId,
        },
      },
    });

    return { product: toEntity(row), created: count > 0 };
  }

  async list(pagination: PaginationInterface): Promise<PageInterface<TrackedProductEntity>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.trackedProduct.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(pagination),
        take: pagination.pageSize,
      }),
      this.prisma.trackedProduct.count(),
    ]);

    return { items: rows.map(toEntity), total };
  }

  async findById(id: string): Promise<TrackedProductEntity | null> {
    const row = await this.prisma.trackedProduct.findUnique({ where: { id } });

    return row === null ? null : toEntity(row);
  }

  async markChecked(id: string, status: string, checkedAt: Date): Promise<void> {
    await this.prisma.trackedProduct.updateMany({
      where: { id },
      data: { lastStatus: status, lastCheckedAt: checkedAt },
    });
  }
}
