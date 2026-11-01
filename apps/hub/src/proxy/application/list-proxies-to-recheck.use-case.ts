import type { ProxyRepositoryPort } from './proxy-repository.port.js';

/** The found proxies no list has named lately, which only a recheck can tell alive from dead. */
export class ListProxiesToRecheckUseCase {
  constructor(private readonly proxies: ProxyRepositoryPort) {}

  async execute(now: Date, unseenForMs: number, limit: number): Promise<string[]> {
    const unseen = await this.proxies.listUnseen(new Date(now.getTime() - unseenForMs), limit);

    return unseen.map((proxy): string => proxy.snapshot.server);
  }
}
