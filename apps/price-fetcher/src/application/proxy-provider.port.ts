import type { ProxyEndpointEntity } from 'proxy-endpoint';

export interface ProxyProviderPort {
  /** A null candidate is a direct connection. */
  getCandidates(signal: AbortSignal): Promise<Array<ProxyEndpointEntity | null>>;
}
