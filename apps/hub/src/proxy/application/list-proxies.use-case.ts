import type {
  PageInterface,
  PaginationInterface,
} from '../../shared/application/page.interface.js';
import type { ProxyEntity } from '../domain/proxy.entity.js';
import type { ProxyRepositoryPort } from './proxy-repository.port.js';

export interface ProxyListFilterInterface {
  alive?: boolean;
  country?: string;
  disabled?: boolean;
}

export class ListProxiesUseCase {
  constructor(private readonly proxies: ProxyRepositoryPort) {}

  execute(
    filter: ProxyListFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyEntity>> {
    return this.proxies.list(
      {
        ...(filter.alive === undefined ? {} : { alive: filter.alive }),
        ...(filter.country === undefined ? {} : { country: filter.country }),
        ...(filter.disabled === undefined ? {} : { disabled: filter.disabled }),
      },
      pagination,
    );
  }
}
