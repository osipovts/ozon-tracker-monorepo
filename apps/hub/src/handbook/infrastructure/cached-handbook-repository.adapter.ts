import type { HandbookCityType, HandbookType } from 'queue-contract';

import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type {
  HandbookRepositoryPort,
  StoredCitiesInterface,
} from '../application/handbook-repository.port.js';

/**
 * Keeps what the handbooks hold in memory for a while: the cities are asked for with every key the user
 * types, and read from the store as a whole each time. A save here is seen at once; one made by another
 * instance of the hub is seen when the time is up, which a handbook that changes weekly can wait for.
 */
export class CachedHandbookRepositoryAdapter implements HandbookRepositoryPort {
  private readonly cached = new Map<
    HandbookType,
    { stored: StoredCitiesInterface | null; until: number }
  >();

  constructor(
    private readonly handbooks: HandbookRepositoryPort,
    private readonly ttlMs: number,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async findCities(handbook: HandbookType): Promise<StoredCitiesInterface | null> {
    const now = this.clock.now().getTime();
    const hit = this.cached.get(handbook);
    if (hit !== undefined && hit.until > now) return hit.stored;

    const stored = await this.handbooks.findCities(handbook);
    this.cached.set(handbook, { stored, until: now + this.ttlMs });

    return stored;
  }

  async saveCities(
    handbook: HandbookType,
    cities: HandbookCityType[],
    fetchedAt: Date,
  ): Promise<void> {
    await this.handbooks.saveCities(handbook, cities, fetchedAt);
    this.cached.delete(handbook);
  }
}
