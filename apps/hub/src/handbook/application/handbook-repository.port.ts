import type { HandbookCityType, HandbookType } from 'queue-contract';

export const HANDBOOK_REPOSITORY = Symbol('HandbookRepositoryPort');

export interface StoredCitiesInterface {
  cities: HandbookCityType[];
  fetchedAt: Date;
}

export interface HandbookRepositoryPort {
  /** The cities the handbook has, with the time they were read; null if it was never read. */
  findCities(handbook: HandbookType): Promise<StoredCitiesInterface | null>;
  /** Replaces what the handbook has with the cities. */
  saveCities(handbook: HandbookType, cities: HandbookCityType[], fetchedAt: Date): Promise<void>;
}
