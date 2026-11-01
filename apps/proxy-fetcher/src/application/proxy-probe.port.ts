import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ProxyProbeResultInterface } from '../domain/proxy-probe-result.interface.js';

export interface ProxyProbePort {
  /** Never rejects because of an unhealthy proxy: it reports `alive: false` instead. */
  probe(
    proxy: ProxyEndpointEntity,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<ProxyProbeResultInterface>;
}
