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
    const known = new Map(
      (await this.proxies.findByServers(checks.map((check): string => check.server))).map(
        (proxy): [string, ProxyEntity] => [proxy.server, proxy],
      ),
    );

    // Several checks of one proxy in a batch are applied in order.
    const updated = new Map<string, ProxyEntity>();
    for (const check of checks)
      updated.set(
        check.server,
        ProxyEntity.fromCheck(check, updated.get(check.server) ?? known.get(check.server)),
      );

    await this.proxies.saveMany(Array.from(updated.values()));
    this.logger.debug(
      `Recorded ${String(checks.length)} checks of ${String(updated.size)} proxies, ${String(checks.filter((check): boolean => check.alive).length)} alive`,
    );
  }
}
