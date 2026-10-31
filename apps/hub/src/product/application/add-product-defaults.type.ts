import { NoProxiesAvailableError } from './no-proxies-available.error.js';
import type { ProductLimitsInterface } from './product-quota.type.js';
import type { RequestPriceObservationUseCase } from './request-price-observation.use-case.js';

/** For the tests that are not about the quotas: nothing is refused. */
export const unlimitedProducts: ProductLimitsInterface = {
  maxProducts: Number.MAX_SAFE_INTEGER,
  add: { limit: Number.MAX_SAFE_INTEGER, windowMs: 60_000 },
};

/** For the tests that are not about the first price: no route to read it through, so none is queued. */
export const noPriceReads: Pick<RequestPriceObservationUseCase, 'execute'> = {
  execute: (): Promise<{ jobId: string }> => Promise.reject(new NoProxiesAvailableError()),
};
