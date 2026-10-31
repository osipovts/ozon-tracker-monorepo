import { ProxyNotFoundError } from './proxy-not-found.error.js';
import type { ProxyRepositoryPort } from './proxy-repository.port.js';

/** Deletes a proxy; the next refresh of its source finds it again, if it is still there: turn it off to keep it away. */
export class DeleteProxyUseCase {
  constructor(private readonly proxies: ProxyRepositoryPort) {}

  async execute(server: string): Promise<void> {
    if (!(await this.proxies.delete(server))) throw new ProxyNotFoundError(server);
  }
}
