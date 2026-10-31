import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import { ProxyNotFoundError } from './proxy-not-found.error.js';
import type { ProxyRepositoryPort } from './proxy-repository.port.js';

/** Turns a proxy off or on: one that is off is not given to the workers, and stays in the list. */
export class SetProxyDisabledUseCase {
  constructor(
    private readonly proxies: ProxyRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async execute(server: string, disabled: boolean): Promise<void> {
    const [proxy] = await this.proxies.findByServers([server]);
    if (proxy === undefined) throw new ProxyNotFoundError(server);

    await this.proxies.saveMany([disabled ? proxy.disabled(this.clock.now()) : proxy.enabled()]);
  }
}
