import type { PriceFetchRequestInterface, ProxyFetchRequestInterface } from './job-queue.port.js';

/** What a context asks the job context to run; the id of the job is the job context's to give. */
export type JobRequestType = {
  /** The user who asks, who alone may read the job; null for the operator. */
  requestedBy: string | null;
} & (
  | ({ kind: 'proxy_fetch' } & Omit<ProxyFetchRequestInterface, 'jobId'>)
  | ({
      kind: 'price_fetch';
      /** The tracked product the job reads the price of. */
      productId: string;
    } & Omit<PriceFetchRequestInterface, 'jobId'>)
);
