import type { HandbookCityType, HandbookType } from 'queue-contract';

import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { HandbookRepositoryPort } from './handbook-repository.port.js';

/** Keeps the cities a fetcher read: they replace the ones the handbook had. */
export class SaveHandbookCitiesUseCase {
  constructor(
    private readonly handbooks: HandbookRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  execute(handbook: HandbookType, cities: HandbookCityType[]): Promise<void> {
    return this.handbooks.saveCities(handbook, cities, this.clock.now());
  }
}
