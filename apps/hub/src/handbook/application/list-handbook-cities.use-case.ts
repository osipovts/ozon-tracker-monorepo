import type { HandbookCityType, HandbookType } from 'queue-contract';

import {
  type PageInterface,
  pageOf,
  type PaginationInterface,
} from '../../shared/application/page.interface.js';
import type { HandbookRepositoryPort } from './handbook-repository.port.js';

export interface HandbookCitiesQueryInterface extends PaginationInterface {
  /** A part of the name or of the region, in any case; empty gives all. */
  query: string;
}

export interface HandbookCitiesInterface {
  /** When the cities were read; null if they never were. */
  fetchedAt: Date | null;
  page: PageInterface<HandbookCityType>;
}

/** The cities a handbook keeps, a page of them, for the one who looks after the handbooks. */
export class ListHandbookCitiesUseCase {
  constructor(private readonly handbooks: HandbookRepositoryPort) {}

  async execute(
    handbook: HandbookType,
    query: HandbookCitiesQueryInterface,
  ): Promise<HandbookCitiesInterface> {
    const stored = await this.handbooks.findCities(handbook);
    if (stored === null) return { fetchedAt: null, page: { items: [], total: 0 } };

    const needle = query.query.trim().toLocaleLowerCase('ru');
    const matching = stored.cities.filter((city): boolean =>
      `${city.name}\n${city.region ?? ''}`.toLocaleLowerCase('ru').includes(needle),
    );

    return { fetchedAt: stored.fetchedAt, page: pageOf(matching, query) };
  }
}
