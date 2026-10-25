import type {
  ProxyFilterInterface,
  ProxyRepositoryPort,
} from '../../application/proxy/proxy-repository.port.js';
import {
  type PageInterface,
  pageOffset,
  type PaginationInterface,
} from '../../application/shared/page.interface.js';
import { ProxyEntity } from '../../domain/proxy/proxy.entity.js';
import type { PrismaClient, Proxy as ProxyRow } from '../../generated/prisma/client.js';

function toEntity(row: ProxyRow): ProxyEntity {
  return new ProxyEntity({
    server: row.server,
    source: row.source,
    country: row.country,
    exitIp: row.exitIp,
    alive: row.alive,
    latencyMs: row.latencyMs,
    checksTotal: row.checksTotal,
    checksAlive: row.checksAlive,
    lastCheckedAt: row.lastCheckedAt,
  });
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
        const { server, ...rest } = proxy.snapshot;
        const data = { ...rest, successRate: proxy.successRate };

        return this.prisma.proxy.upsert({
          where: { server },
          create: { server, ...data },
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
        skip: pageOffset(pagination),
        take: pagination.pageSize,
      }),
      this.prisma.proxy.count({ where }),
    ]);

    return { items: rows.map(toEntity), total };
  }
}
