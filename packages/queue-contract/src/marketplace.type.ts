import { marketplaces } from 'product-reference';
import { z } from 'zod';

export const marketplaceSchema = z.enum(marketplaces);
