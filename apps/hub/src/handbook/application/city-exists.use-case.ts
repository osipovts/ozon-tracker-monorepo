import type { MarketplaceType } from 'product-reference';

import type { HandbookRepositoryPort } from './handbook-repository.port.js';
import { marketplaceCityHandbooks } from './marketplace-city-handbooks.type.js';

export class CityExistsUseCase {
  constructor(private readonly handbooks: HandbookRepositoryPort) {}

  /** Whether the marketplace has the city, by the id it gives it. */
  async execute(marketplace: MarketplaceType, cityId: string): Promise<boolean> {
    const handbook = marketplaceCityHandbooks[marketplace];
    if (handbook === undefined) return false;

    const stored = await this.handbooks.findCities(handbook);

    return stored?.cities.some((city): boolean => city.id === cityId) ?? false;
  }
}
