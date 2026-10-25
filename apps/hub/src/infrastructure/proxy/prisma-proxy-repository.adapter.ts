import type {
  ProxyFilterInterface,
  ProxyRepositoryPort,
} from '../../application/proxy/proxy-repository.port.js';
import type {
  PageInterface,
  PaginationInterface,
} from '../../application/shared/page.interface.js';
import { ProxyEntity } from '../../domain/proxy/proxy.entity.js';
import type { PrismaClient, Proxy as ProxyRow } from '../../generated/prisma/client.js';

function toEntity(row: ProxyRow): ProxyEntity {
  return new ProxyEntity(
    row.server,
    row.source,
    row.country,
    row.exitIp,
    row.alive,
    row.latencyMs,
    row.checksTotal,
    row.checksAlive,
    row.lastCheckedAt,
  );
}

export class PrismaProxyRepositoryAdapter implements ProxyRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findByServers(servers: string[]): Promise<ProxyEntity[]> {
    const rows = await this.prisma.proxy.findMany({ where: { server: { in: servers } } });

    return rows.map(toEntity);
  }

  async saveMany(proxies: ProxyEntity[]): Promise<void> {
    await this.prisma.$transaction(
      proxies.map((proxy) => {
        const data = {
          source: proxy.source,
          country: proxy.country,
          exitIp: proxy.exitIp,
          alive: proxy.alive,
          latencyMs: proxy.latencyMs,
          checksTotal: proxy.checksTotal,
          checksAlive: proxy.checksAlive,
          successRate: proxy.successRate,
          lastCheckedAt: proxy.lastCheckedAt,
        };

        return this.prisma.proxy.upsert({
          where: { server: proxy.server },
          create: { server: proxy.server, ...data },
          update: data,
        });
      }),
    );
  }

  async list(
    filter: ProxyFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyEntity>> {
    const where = {
      ...(filter.alive === undefined ? {} : { alive: filter.alive }),
      ...(filter.country === undefined ? {} : { country: filter.country }),
      ...(filter.servers === undefined && filter.excludedServers === undefined
        ? {}
        : {
            server: {
              ...(filter.servers === undefined ? {} : { in: [...filter.servers] }),
              ...(filter.excludedServers === undefined
                ? {}
                : { notIn: [...filter.excludedServers] }),
            },
          }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.proxy.findMany({
        where,
        orderBy: [
          { alive: 'desc' },
          { successRate: 'desc' },
          { latencyMs: { sort: 'asc', nulls: 'last' } },
        ],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.proxy.count({ where }),
    ]);

    return { items: rows.map(toEntity), total };
  }
}
