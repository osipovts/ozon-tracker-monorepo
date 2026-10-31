import type {
  HandbookFetchRequestInterface,
  PriceFetchRequestInterface,
  ProxyFetchRequestInterface,
} from './job-queue.port.js';

/** What a context asks the job context to run; the id of the job is the job context's to give. */
export type JobRequestType = {
  /** The user who asks, who alone may read the job; null for the operator. */
  requestedBy: string | null;
} & (
  | ({ kind: 'proxy_fetch' } & Omit<ProxyFetchRequestInterface, 'jobId'>)
  | ({ kind: 'handbook_fetch' } & Omit<HandbookFetchRequestInterface, 'jobId'>)
  | ({
      kind: 'price_fetch';
      /** What the job is about: the tracked product it reads the price of, or the marketplace of a batch. */
      subject: string;
    } & Omit<PriceFetchRequestInterface, 'jobId'>)
);
