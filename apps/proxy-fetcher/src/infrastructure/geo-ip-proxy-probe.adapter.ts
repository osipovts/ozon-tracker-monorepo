import type { Agent } from 'node:http';
import { request } from 'node:https';

import { HttpsProxyAgent } from 'https-proxy-agent';
import { errorMessage, type LoggerPort, silentLogger } from 'logger';
import type { ProxyEndpointEntity } from 'proxy-endpoint';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { z } from 'zod';

import type { ProxyProbePort } from '../application/proxy-probe.port.js';
import type { ProxyProbeResultInterface } from '../domain/proxy-probe-result.interface.js';

const geoSchema = z.object({
  ip: z.ipv4(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});
const maxBodyLength = 8192;

/** Checks a proxy by asking a GeoIP service for the exit address through it. */
export class GeoIpProxyProbeAdapter implements ProxyProbePort {
  constructor(
    private readonly targetUrl = 'https://ipinfo.io/json',
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async probe(
    proxy: ProxyEndpointEntity,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<ProxyProbeResultInterface> {
    const checkedAt = new Date().toISOString();
    const startedAt = performance.now();
    const agent = this.createAgent(proxy);

    try {
      const body = await this.readBody(
        agent,
        AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      );
      const geo = geoSchema.parse(JSON.parse(body));
      const latencyMs = Math.round(performance.now() - startedAt);
      this.logger.verbose(
        `${proxy.server} alive: ${String(latencyMs)} ms, exit ${geo.ip} ${geo.country ?? '??'}`,
      );

      return {
        server: proxy.server,
        alive: true,
        latencyMs,
        country: geo.country ?? null,
        exitIp: geo.ip,
        checkedAt,
      };
    } catch (error: unknown) {
      signal.throwIfAborted();
      this.logger.verbose(`${proxy.server} dead: ${errorMessage(error)}`);

      return {
        server: proxy.server,
        alive: false,
        latencyMs: null,
        country: null,
        exitIp: null,
        checkedAt,
      };
    } finally {
      agent.destroy();
    }
  }

  private createAgent(proxy: ProxyEndpointEntity): Agent {
    const url = new URL(proxy.server);
    if (url.protocol === 'socks5:') return new SocksProxyAgent(url);

    url.username = proxy.username;
    url.password = proxy.password;

    return new HttpsProxyAgent(url);
  }

  private readBody(agent: Agent, signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject): void => {
      const outgoing = request(
        this.targetUrl,
        { agent, signal, headers: { accept: 'application/json' } },
        (response): void => {
          if (response.statusCode !== 200) {
            response.resume();
            reject(new Error('Unexpected status'));

            return;
          }

          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string): void => {
            body += chunk;
            if (body.length > maxBodyLength) outgoing.destroy(new Error('Response too large'));
          });
          response.on('end', (): void => {
            resolve(body);
          });
          response.on('error', reject);
        },
      );

      outgoing.on('error', reject);
      outgoing.end();
    });
  }
}
