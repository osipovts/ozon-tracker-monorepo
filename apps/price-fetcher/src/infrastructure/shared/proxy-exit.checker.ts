import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { GeoIpInterface } from './geo-ip-page.parser.js';

export type ProxyExitType =
  | { status: 'confirmed'; exitIp: string }
  /** The exit is in another country: the marketplace shows the prices of that one, or refuses. */
  | { status: 'rejected' }
  /** The GeoIP service did not answer: nothing is known of the proxy. */
  | { status: 'unavailable' };

/**
 * Tells where a proxy exits to the internet. What a proxy was found to be stays known for a while: the
 * answer is the same for every product of a job that goes through it, and the GeoIP service is not asked
 * again for each, which would also turn a limit of that service into a rejection of good proxies.
 */
export class ProxyExitChecker {
  private readonly known = new Map<string, { exit: ProxyExitType; until: number }>();

  constructor(
    private readonly ttlMs: number = 10 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** `ask` reads the exit from the GeoIP service, through the proxy; it is called only when the proxy is not known. */
  async check(
    proxy: ProxyEndpointEntity,
    country: string,
    ask: () => Promise<GeoIpInterface | null>,
  ): Promise<ProxyExitType> {
    const key = `${proxy.server}\n${country}`;
    const hit = this.known.get(key);
    if (hit !== undefined && hit.until > this.now()) return hit.exit;

    const geo = await ask();
    if (geo === null) return { status: 'unavailable' };

    const exit: ProxyExitType =
      geo.country === country ? { status: 'confirmed', exitIp: geo.ip } : { status: 'rejected' };
    this.known.set(key, { exit, until: this.now() + this.ttlMs });

    return exit;
  }
}
