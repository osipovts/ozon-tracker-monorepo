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

  async add(session: AuthSessionEntity): Promise<void> {
    await this.prisma.authSession.create({ data: session.snapshot });
  }

  async touch(sessionId: string, lastSeenAt: Date, expiresAt: Date): Promise<void> {
    // Only a live session, and only these two columns: a stale write of the whole row is what
    // once put a revoked session back to life.
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastSeenAt, expiresAt },
    });
  }

  async revoke(sessionId: string, at: Date): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: at },
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

  async revokeOthers(userId: string, keepSessionId: string | null, at: Date): Promise<number> {
    const { count } = await this.prisma.authSession.updateMany({
      where: {
        userId,
        ...(keepSessionId === null ? {} : { id: { not: keepSessionId } }),
        revokedAt: null,
        expiresAt: { gt: at },
      },
      data: { revokedAt: at },
    });

    return count;
  }
}
