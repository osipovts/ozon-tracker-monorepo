import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import type { ProxyEndpointEntity } from 'proxy-endpoint';
import { z } from 'zod';

import type { CityLetterSourcePort } from '../application/city-letter-source.port.js';
import type { CityInterface } from '../domain/city.interface.js';
import { ProxyAgentFactory } from './proxy-agent.factory.js';

const answerSchema = z.object({
  data: z.object({
    cities: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1),
        regionName: z.string().trim().optional(),
      }),
    ),
  }),
});
const maxBodyLength = 4_000_000;

/** The city selector of DNS asks the API for the cities by the first letter of their names. */
export class DnsCitiesByLetterSourceAdapter implements CityLetterSourcePort {
  constructor(
    private readonly baseUrl = 'https://restapi.dns-shop.ru',
    private readonly timeoutMs = 20_000,
    private readonly agents = new ProxyAgentFactory(),
  ) {}

  async read(
    letter: string,
    proxy: ProxyEndpointEntity | null,
    signal: AbortSignal,
  ): Promise<CityInterface[]> {
    const url = new URL(
      `/v1/site/get-cities-by-letter?letter=${encodeURIComponent(letter)}`,
      this.baseUrl,
    );
    const agent = this.agents.create(proxy);

    try {
      const body = await this.readBody(
        url,
        agent,
        AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]),
      );

      return answerSchema
        .parse(JSON.parse(body))
        .data.cities.map(({ id, name, regionName }): CityInterface => ({
          id,
          name,
          region: regionName === undefined || regionName === '' ? null : regionName,
        }));
    } finally {
      agent?.destroy();
    }
  }

  private readBody(
    url: URL,
    agent: ReturnType<ProxyAgentFactory['create']>,
    signal: AbortSignal,
  ): Promise<string> {
    const request = url.protocol === 'http:' ? httpRequest : httpsRequest;

    return new Promise((resolve, reject): void => {
      const outgoing = request(
        url,
        {
          ...(agent === undefined ? {} : { agent }),
          signal,
          headers: {
            accept: 'application/json',
            origin: 'https://www.dns-shop.ru',
            referer: 'https://www.dns-shop.ru/',
          },
        },
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
