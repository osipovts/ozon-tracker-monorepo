import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ProxySourceType } from '../domain/proxy-source.type.js';

export interface ProxySourcePort {
  /** Stable identifier of the source, used for routing and attribution. */
  readonly name: ProxySourceType;
  /** Returns unique candidates with a supported protocol and a public IPv4 address. */
  fetchCandidates(signal: AbortSignal): Promise<ProxyEndpointEntity[]>;
}
