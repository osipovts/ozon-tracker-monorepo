import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ProxyCheckInterface } from '../domain/proxy-check.interface.js';

export interface ProxyProbePort {
  /** Never rejects because of an unhealthy proxy: it reports `alive: false` instead. */
  probe(
    proxy: ProxyEndpointEntity,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<ProxyCheckInterface>;
}
