import type { MarketplaceType } from 'product-reference';
import type { HandbookCityType } from 'queue-contract';

import type { HandbookRepositoryPort } from './handbook-repository.port.js';
import { marketplaceCityHandbooks } from './marketplace-city-handbooks.type.js';
import { MarketplaceWithoutCitiesError } from './marketplace-without-cities.error.js';

export interface CitySearchInterface {
  /** A part of the name, in any case; empty gives the first cities by name. */
  query: string;
  limit: number;
}

/** The cities of a marketplace whose names have the query in them, the ones that begin with it first. */
export class SearchCitiesUseCase {
  constructor(private readonly handbooks: HandbookRepositoryPort) {}

  /** Empty until the handbook is read. */
  async execute(
    marketplace: MarketplaceType,
    search: CitySearchInterface,
  ): Promise<HandbookCityType[]> {
    const handbook = marketplaceCityHandbooks[marketplace];
    if (handbook === undefined) throw new MarketplaceWithoutCitiesError(marketplace);

    const stored = await this.handbooks.findCities(handbook);
    const query = search.query.trim().toLocaleLowerCase('ru');
    const matching = (stored?.cities ?? []).filter((city): boolean =>
      city.name.toLocaleLowerCase('ru').includes(query),
    );
    const begins = (city: HandbookCityType): boolean =>
      city.name.toLocaleLowerCase('ru').startsWith(query);

    return [...matching.filter(begins), ...matching.filter((city): boolean => !begins(city))].slice(
      0,
      search.limit,
    );
  }
}
