import type { ProxyRepositoryPort } from './proxy-repository.port.js';

/** Deletes every proxy; the next refresh of a source finds the listed ones again. */
export class DeleteAllProxiesUseCase {
  constructor(private readonly proxies: ProxyRepositoryPort) {}

  execute(): Promise<number> {
    return this.proxies.deleteAll();
  }
}
