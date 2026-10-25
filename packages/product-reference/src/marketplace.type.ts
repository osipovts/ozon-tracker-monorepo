export const marketplaces = ['ozon'] as const;

export type MarketplaceType = (typeof marketplaces)[number];

/** A marketplace serves its prices to visitors from this country only (ISO 3166-1 alpha-2). */
export const marketplaceExitCountries: Readonly<Record<MarketplaceType, string>> = { ozon: 'RU' };
