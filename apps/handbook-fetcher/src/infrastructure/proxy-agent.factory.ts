import type { Agent } from 'node:http';

import { HttpsProxyAgent } from 'https-proxy-agent';
import type { ProxyEndpointEntity } from 'proxy-endpoint';
import { SocksProxyAgent } from 'socks-proxy-agent';

export class ProxyAgentFactory {
  /** The agent that connects through the proxy; none for a direct connection. */
  create(proxy: ProxyEndpointEntity | null): Agent | undefined {
    if (proxy === null) return undefined;

    const url = new URL(proxy.server);
    if (url.protocol === 'socks5:') return new SocksProxyAgent(url);

    url.username = proxy.username;
    url.password = proxy.password;

    return new HttpsProxyAgent(url);
  }
}
