import { type LoggerPort, silentLogger } from 'logger';

import { ProxyEntity } from '../../domain/proxy/proxy.entity.js';
import type { ProxyCheckInterface } from '../../domain/proxy/proxy-check.interface.js';
import type { ProxyRepositoryPort } from './proxy-repository.port.js';

export class RecordProxyChecksUseCase {
  constructor(
    private readonly proxies: ProxyRepositoryPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(checks: ProxyCheckInterface[]): Promise<void> {
    // Several checks of one proxy in a batch are applied in order.
    const known = new Map(
      (await this.proxies.findByServers(checks.map((check): string => check.server))).map(
        (proxy): [string, ProxyEntity] => [proxy.server, proxy],
      ),
    );
    for (const check of checks)
      known.set(check.server, ProxyEntity.fromCheck(check, known.get(check.server)));
    const updated = Array.from(
      new Set(checks.map((check): string => check.server)),
      (server): ProxyEntity => {
        const proxy = known.get(server);
        if (proxy === undefined) throw new Error('Unreachable: the proxy was just computed');
        return proxy;
      },
    );
    await this.proxies.saveMany(updated);
    this.logger.debug(
      `Recorded ${String(checks.length)} checks of ${String(updated.length)} proxies, ${String(checks.filter((check): boolean => check.alive).length)} alive`,
    );
  }
}
