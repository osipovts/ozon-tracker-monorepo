import type { BrowserSessionInterface } from '../../browser-session/domain/browser-session.entity.js';
import type { ProxySourceType } from '../../proxy/domain/proxy-source.type.js';

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
  session: Pick<BrowserSessionInterface, 'id' | 'exitIp' | 'userAgent' | 'storageState'> | null;
}

export interface PriceFetchRequestInterface {
  jobId: string;
  routes: RouteInterface[];
  products: Array<{ trackedProductId: string; url: string }>;
  timeoutMs: number;
}

export interface JobQueuePort {
  enqueueProxyFetch(request: ProxyFetchRequestInterface): Promise<void>;
  enqueuePriceFetch(request: PriceFetchRequestInterface): Promise<void>;
}
