import type { PrismaClient, Proxy as ProxyRow } from '../../generated/prisma/client.js';
import {
  type PageInterface,
  pageOffset,
  type PaginationInterface,
} from '../../shared/application/page.interface.js';
import type {
  ProxyFilterInterface,
  ProxyRepositoryPort,
  ProxyStatsInterface,
} from '../application/proxy-repository.port.js';
import { manualProxySource, ProxyEntity } from '../domain/proxy.entity.js';

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
    disabledAt: row.disabledAt,
    credentials:
      row.username === null || row.password === null
        ? null
        : { username: row.username, password: row.password },
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
        const { server, credentials, ...rest } = proxy.snapshot;
        const data = {
          ...rest,
          username: credentials?.username ?? null,
          password: credentials?.password ?? null,
          successRate: proxy.successRate,
        };

        return this.prisma.proxy.upsert({
          where: { server },
          create: { server, ...data },
          update: data,
        });
      }),
    );
  }

  async stats(): Promise<ProxyStatsInterface> {
    const [total, alive, disabled, aggregate] = await this.prisma.$transaction([
      this.prisma.proxy.count(),
      this.prisma.proxy.count({ where: { alive: true } }),
      this.prisma.proxy.count({ where: { disabledAt: { not: null } } }),
      this.prisma.proxy.aggregate({
        where: { alive: true },
        _avg: { latencyMs: true },
        _max: { lastCheckedAt: true },
      }),
    ]);
    const { _max: latest } = await this.prisma.proxy.aggregate({ _max: { lastCheckedAt: true } });
    const average = aggregate._avg.latencyMs;

    return {
      total,
      alive,
      disabled,
      averageLatencyMs: average === null ? null : Math.round(average),
      lastCheckedAt: latest.lastCheckedAt,
    };
  }

  async delete(server: string): Promise<boolean> {
    const { count } = await this.prisma.proxy.deleteMany({ where: { server } });

    return count > 0;
  }

  async deleteAll(): Promise<number> {
    const { count } = await this.prisma.proxy.deleteMany();

    return count;
  }

  async list(
    filter: ProxyFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyEntity>> {
    const where = {
      ...(filter.alive === undefined ? {} : { alive: filter.alive }),
      ...(filter.country === undefined ? {} : { country: filter.country }),
      ...(filter.disabled === undefined
        ? {}
        : { disabledAt: filter.disabled ? { not: null } : null }),
      ...(filter.manual === undefined
        ? {}
        : { source: filter.manual ? manualProxySource : { not: manualProxySource } }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.proxy.findMany({
        where,
        orderBy: [
          { alive: 'desc' },
          { successRate: 'desc' },
          { latencyMs: { sort: 'asc', nulls: 'last' } },
          // Equals stay in one order: without it a row that was updated jumps among its equals.
          { server: 'asc' },
        ],
        skip: pageOffset(pagination),
        take: pagination.pageSize,
      }),
      this.prisma.proxy.count({ where }),
    ]);

    return { items: rows.map(toEntity), total };
  }
}
