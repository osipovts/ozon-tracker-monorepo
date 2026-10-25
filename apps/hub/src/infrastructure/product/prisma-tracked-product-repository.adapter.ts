import type {
  TrackedProductReferenceInterface,
  TrackedProductRepositoryPort,
} from '../../application/product/tracked-product-repository.port.js';
import type {
  PageInterface,
  PaginationInterface,
} from '../../application/shared/page.interface.js';
import { TrackedProductEntity } from '../../domain/product/tracked-product.entity.js';
import type {
  PrismaClient,
  TrackedProduct as TrackedProductRow,
} from '../../generated/prisma/client.js';

function toEntity(row: TrackedProductRow): TrackedProductEntity {
  return new TrackedProductEntity(
    row.id,
    row.marketplace,
    row.externalId,
    row.url,
    row.lastStatus,
    row.lastCheckedAt,
  );
}

export class PrismaTrackedProductRepositoryAdapter implements TrackedProductRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(reference: TrackedProductReferenceInterface): Promise<TrackedProductEntity> {
    return toEntity(
      await this.prisma.trackedProduct.upsert({
        where: {
          marketplaceExternalId: {
            marketplace: reference.marketplace,
            externalId: reference.externalId,
          },
        },
        create: reference,
        update: { url: reference.url },
      }),
    );
  }

  async findByExternalId(
    marketplace: string,
    externalId: string,
  ): Promise<TrackedProductEntity | null> {
    const row = await this.prisma.trackedProduct.findUnique({
      where: { marketplaceExternalId: { marketplace, externalId } },
    });

    return row === null ? null : toEntity(row);
  }

  async list(pagination: PaginationInterface): Promise<PageInterface<TrackedProductEntity>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.trackedProduct.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.pageSize,
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
