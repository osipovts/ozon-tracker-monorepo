import { z } from 'zod';

import type { PriceObservationRepositoryPort } from '../../application/product/price-observation-repository.port.js';
import type {
  PageInterface,
  PaginationInterface,
} from '../../application/shared/page.interface.js';
import type { PriceObservationInterface } from '../../domain/product/price-observation.interface.js';
import type {
  PriceObservation as PriceObservationRow,
  PrismaClient,
} from '../../generated/prisma/client.js';

const pricesSchema = z.array(
  z.object({
    amountMinor: z.number().int(),
    currency: z.literal('RUB'),
  }),
);
const availabilitySchema = z.enum(['in_stock', 'out_of_stock', 'unknown']);

function toObservation(row: PriceObservationRow): PriceObservationInterface {
  return {
    id: row.id,
    trackedProductId: row.trackedProductId,
    jobId: row.jobId,
    status: row.status,
    title: row.title,
    observedAt: row.observedAt,
    availability: availabilitySchema.parse(row.availability),
    prices: pricesSchema.parse(row.prices),
    exitIp: row.exitIp,
  };
}

export class PrismaPriceObservationRepositoryAdapter implements PriceObservationRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async saveIfAbsent(observation: PriceObservationInterface): Promise<void> {
    await this.prisma.priceObservation.createMany({
      data: [
        {
          id: observation.id,
          trackedProductId: observation.trackedProductId,
          jobId: observation.jobId,
          status: observation.status,
          title: observation.title,
          observedAt: observation.observedAt,
          availability: observation.availability,
          prices: observation.prices.map((price) => ({
            amountMinor: price.amountMinor,
            currency: price.currency,
          })),
          exitIp: observation.exitIp,
        },
      ],
      skipDuplicates: true,
    });
  }

  async findLatestByProducts(
    trackedProductIds: readonly string[],
  ): Promise<PriceObservationInterface[]> {
    const rows = await this.prisma.priceObservation.findMany({
      where: { trackedProductId: { in: [...trackedProductIds] } },
      orderBy: [{ trackedProductId: 'asc' }, { observedAt: 'desc' }],
      distinct: ['trackedProductId'],
    });
    return rows.map(toObservation);
  }

  async listByProduct(
    trackedProductId: string,
    pagination: PaginationInterface,
  ): Promise<PageInterface<PriceObservationInterface>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.priceObservation.findMany({
        where: { trackedProductId },
        orderBy: { observedAt: 'desc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.priceObservation.count({ where: { trackedProductId } }),
    ]);
    return { items: rows.map(toObservation), total };
  }
}
