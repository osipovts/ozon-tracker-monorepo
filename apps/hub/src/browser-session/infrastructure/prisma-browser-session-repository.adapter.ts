import { storageStateSchema } from 'queue-contract';
import { z } from 'zod';

import type {
  BrowserSession as BrowserSessionRow,
  PrismaClient,
} from '../../generated/prisma/client.js';
import {
  type PageInterface,
  pageOffset,
  type PaginationInterface,
} from '../../shared/application/page.interface.js';
import type {
  BrowserSessionRepositoryPort,
  BrowserSessionStatsInterface,
} from '../application/browser-session-repository.port.js';
import { BrowserSessionEntity, sessionStatuses } from '../domain/browser-session.entity.js';

const statusSchema = z.enum(sessionStatuses);

function toEntity(row: BrowserSessionRow): BrowserSessionEntity {
  return new BrowserSessionEntity({
    id: row.id,
    marketplace: row.marketplace,
    proxyServer: row.proxyServer,
    exitIp: row.exitIp,
    userAgent: row.userAgent,
    storageState: storageStateSchema.parse(row.storageState),
    status: statusSchema.parse(row.status),
    staleReason: row.staleReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastUsedAt: row.lastUsedAt,
  });
}

export class PrismaBrowserSessionRepositoryAdapter implements BrowserSessionRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async save(session: BrowserSessionEntity): Promise<void> {
    const { id, storageState, ...rest } = session.snapshot;
    const data = {
      ...rest,
      routeKey: session.routeKey,
      storageState: storageStateSchema.parse(storageState),
    };

    await this.prisma.browserSession.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<BrowserSessionEntity | null> {
    const row = await this.prisma.browserSession.findUnique({ where: { id } });

    return row === null ? null : toEntity(row);
  }

  async findByRoute(marketplace: string, routeKey: string): Promise<BrowserSessionEntity | null> {
    const row = await this.prisma.browserSession.findUnique({
      where: { marketplaceRouteKey: { marketplace, routeKey } },
    });

    return row === null ? null : toEntity(row);
  }

  async stats(): Promise<BrowserSessionStatsInterface> {
    const [active, stale] = await this.prisma.$transaction([
      this.prisma.browserSession.count({ where: { status: 'active' } }),
      this.prisma.browserSession.count({ where: { status: { not: 'active' } } }),
    ]);

    return { active, stale };
  }

  async listByMarketplace(marketplace: string): Promise<BrowserSessionEntity[]> {
    const rows = await this.prisma.browserSession.findMany({
      where: { marketplace },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map(toEntity);
  }

  async list(pagination: PaginationInterface): Promise<PageInterface<BrowserSessionEntity>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.browserSession.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(pagination),
        take: pagination.pageSize,
      }),
      this.prisma.browserSession.count(),
    ]);

    return { items: rows.map(toEntity), total };
  }

  async delete(id: string): Promise<boolean> {
    const { count } = await this.prisma.browserSession.deleteMany({ where: { id } });

    return count > 0;
  }
}
