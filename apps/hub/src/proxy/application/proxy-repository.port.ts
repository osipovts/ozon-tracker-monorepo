import type {
  PageInterface,
  PaginationInterface,
} from '../../shared/application/page.interface.js';
import type { ProxyEntity } from '../domain/proxy.entity.js';

export const PROXY_REPOSITORY = Symbol('ProxyRepositoryPort');

export interface ProxyFilterInterface {
  alive?: boolean;
  country?: string;
  /** Only the proxies that are turned off (`true`), or only those that are on (`false`). */
  disabled?: boolean;
  /** Only these proxies. */
  servers?: readonly string[];
  /** All proxies except these. */
  excludedServers?: readonly string[];
}

export interface ProxyRepositoryPort {
  findByServers(servers: string[]): Promise<ProxyEntity[]>;
  saveMany(proxies: ProxyEntity[]): Promise<void>;
  /** Deletes the proxy; false if there was none. */
  delete(server: string): Promise<boolean>;
  /** Best first: alive, then the success rate, then the latency. */
  list(
    filter: ProxyFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyEntity>>;
}
