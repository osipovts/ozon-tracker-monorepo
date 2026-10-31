import { ProxyEndpointEntity } from 'proxy-endpoint';

import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import { ProxyEntity } from '../domain/proxy.entity.js';
import type { ProxyRepositoryPort } from './proxy-repository.port.js';

/** Adds a proxy by hand, or makes a found one manual; the workers are given the manual ones first. */
export class AddManualProxyUseCase {
  constructor(
    private readonly proxies: ProxyRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  /** The address may carry the credentials: they are kept apart from the server. Throws for an unsafe address. */
  async execute(address: string): Promise<void> {
    const { server, username, password } = new ProxyEndpointEntity(address);
    const [known] = await this.proxies.findByServers([server]);

    await this.proxies.saveMany([
      ProxyEntity.manual(
        server,
        username === '' && password === '' ? null : { username, password },
        this.clock.now(),
        known,
      ),
    ]);
  }
}
