import { handbookCitySchema, type HandbookCityType, type HandbookType } from 'queue-contract';
import { z } from 'zod';

import type { PrismaClient } from '../../generated/prisma/client.js';
import type {
  HandbookRepositoryPort,
  StoredCitiesInterface,
} from '../application/handbook-repository.port.js';

const citiesSchema = z.array(handbookCitySchema);

export class PrismaHandbookRepositoryAdapter implements HandbookRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findCities(handbook: HandbookType): Promise<StoredCitiesInterface | null> {
    const row = await this.prisma.handbook.findUnique({ where: { key: handbook } });

    return row === null ? null : { cities: citiesSchema.parse(row.data), fetchedAt: row.fetchedAt };
  }

  async saveCities(
    handbook: HandbookType,
    cities: HandbookCityType[],
    fetchedAt: Date,
  ): Promise<void> {
    await this.prisma.handbook.upsert({
      where: { key: handbook },
      create: { key: handbook, data: cities, fetchedAt },
      update: { data: cities, fetchedAt },
    });
  }
}
