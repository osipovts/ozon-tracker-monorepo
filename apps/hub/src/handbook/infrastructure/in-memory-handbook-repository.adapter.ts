import type { HandbookCityType, HandbookType } from 'queue-contract';

import type {
  HandbookRepositoryPort,
  StoredCitiesInterface,
} from '../application/handbook-repository.port.js';

export class InMemoryHandbookRepositoryAdapter implements HandbookRepositoryPort {
  private readonly handbooks = new Map<HandbookType, StoredCitiesInterface>();

  findCities(handbook: HandbookType): Promise<StoredCitiesInterface | null> {
    return Promise.resolve(this.handbooks.get(handbook) ?? null);
  }

  saveCities(handbook: HandbookType, cities: HandbookCityType[], fetchedAt: Date): Promise<void> {
    this.handbooks.set(handbook, { cities, fetchedAt });

    return Promise.resolve();
  }
}
