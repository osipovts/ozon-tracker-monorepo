import type { ProxySourceType } from '../../domain/proxy/proxy-source.type.js';
import type { StorageStateInterface } from '../../domain/session/browser-session.entity.js';

export const JOB_QUEUE = Symbol('JobQueuePort');

export interface ProxyFetchRequestInterface {
  jobId: string;
  source: ProxySourceType;
  maxCandidates: number;
  probeTimeoutMs: number;
}

export interface SessionPayloadInterface {
  id: string;
  exitIp: string;
  userAgent: string;
  platform: string;
  browserVersion: string;
  storageState: StorageStateInterface;
}

export interface RouteInterface {
  /** Proxy URL in the order of trying; null is a direct connection. */
  server: string | null;
  session: SessionPayloadInterface | null;
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
