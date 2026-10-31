import type { BrowserSessionType, ProxySourceType } from 'queue-contract';

export const JOB_QUEUE = Symbol('JobQueuePort');

export interface ProxyFetchRequestInterface {
  jobId: string;
  source: ProxySourceType;
  maxCandidates: number;
  probeTimeoutMs: number;
}

export interface RouteInterface {
  /** Proxy URL in the order of trying; null is a direct connection. */
  server: string | null;
  session: BrowserSessionType | null;
}

export interface PriceFetchRequestInterface {
  jobId: string;
  routes: RouteInterface[];
  products: Array<{ trackedProductId: string; url: string; cityId?: string }>;
  timeoutMs: number;
}

export interface JobQueuePort {
  enqueueProxyFetch(request: ProxyFetchRequestInterface): Promise<void>;
  enqueuePriceFetch(request: PriceFetchRequestInterface): Promise<void>;
}
