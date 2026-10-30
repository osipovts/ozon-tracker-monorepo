import type { AuthSession as AuthSessionRow, PrismaClient } from '../../generated/prisma/client.js';
import type { AuthSessionRepositoryPort } from '../application/auth-session-repository.port.js';
import { AuthSessionEntity } from '../domain/auth-session.entity.js';

function toEntity(row: AuthSessionRow): AuthSessionEntity {
  return new AuthSessionEntity({
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
    absoluteExpiresAt: row.absoluteExpiresAt,
    revokedAt: row.revokedAt,
  });
}

export class PrismaAuthSessionRepositoryAdapter implements AuthSessionRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async save(session: AuthSessionEntity): Promise<void> {
    const { id, ...data } = session.snapshot;
    await this.prisma.authSession.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  async findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null> {
    const row = await this.prisma.authSession.findUnique({ where: { tokenHash } });

    return row === null ? null : toEntity(row);
  }

  async findById(id: string): Promise<AuthSessionEntity | null> {
    const row = await this.prisma.authSession.findUnique({ where: { id } });

    return row === null ? null : toEntity(row);
  }

  async listActiveByUser(userId: string, at: Date): Promise<AuthSessionEntity[]> {
    const rows = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: at } },
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map(toEntity);
  }

  async revokeOthers(userId: string, keepSessionId: string, at: Date): Promise<number> {
    const { count } = await this.prisma.authSession.updateMany({
      where: { userId, id: { not: keepSessionId }, revokedAt: null, expiresAt: { gt: at } },
      data: { revokedAt: at },
    });

    return count;
  }
}
