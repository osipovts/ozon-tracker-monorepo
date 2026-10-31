export const marketplaces = ['ozon', 'dns'] as const;

export type MarketplaceType = (typeof marketplaces)[number];

/** A marketplace serves its prices to visitors from this country only (ISO 3166-1 alpha-2). */
export const marketplaceExitCountries: Readonly<Record<MarketplaceType, string>> = {
  ozon: 'RU',
  dns: 'RU',
};

/**
 * The city a marketplace whose prices depend on it falls back to, by the id the marketplace gives it.
 * A marketplace that is not here has one price for everyone and no city.
 */
export const marketplaceDefaultCities: Readonly<Partial<Record<MarketplaceType, string>>> = {
  dns: '30b7c1f3-03fb-11dc-95ee-00151716f9f5',
};
