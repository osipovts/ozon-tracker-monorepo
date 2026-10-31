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
  /** Only the proxies added by hand (`true`), or only the found ones (`false`). */
  manual?: boolean;
  /** Only these proxies. */
  servers?: readonly string[];
  /** All proxies except these. */
  excludedServers?: readonly string[];
}

export interface ProxyStatsInterface {
  total: number;
  alive: number;
  /** Turned off by an administrator. */
  disabled: number;
  /** Of the alive ones; null if none is alive. */
  averageLatencyMs: number | null;
  lastCheckedAt: Date | null;
}

export interface ProxyRepositoryPort {
  stats(): Promise<ProxyStatsInterface>;
  findByServers(servers: string[]): Promise<ProxyEntity[]>;
  saveMany(proxies: ProxyEntity[]): Promise<void>;
  /** Deletes the proxy; false if there was none. */
  delete(server: string): Promise<boolean>;
  /** Deletes every proxy; returns how many there were. */
  deleteAll(): Promise<number>;
  /** Best first: alive, then the success rate, then the latency. */
  list(
    filter: ProxyFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyEntity>>;
}
