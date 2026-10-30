import type {
  PageInterface,
  PaginationInterface,
} from '../../shared/application/page.interface.js';
import type { ProxyEntity } from '../domain/proxy.entity.js';

export const PROXY_REPOSITORY = Symbol('ProxyRepositoryPort');

export interface ProxyFilterInterface {
  alive?: boolean;
  country?: string;
  /** Only these proxies. */
  servers?: readonly string[];
  /** All proxies except these. */
  excludedServers?: readonly string[];
}

export interface ProxyRepositoryPort {
  findByServers(servers: string[]): Promise<ProxyEntity[]>;
  saveMany(proxies: ProxyEntity[]): Promise<void>;
  /** Best first: alive, then the success rate, then the latency. */
  list(
    filter: ProxyFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyEntity>>;
}
