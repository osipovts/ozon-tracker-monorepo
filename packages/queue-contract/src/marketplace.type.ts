import { z } from 'zod';

export const marketplaceSchema = z.enum(['ozon']);

export type MarketplaceType = z.infer<typeof marketplaceSchema>;
