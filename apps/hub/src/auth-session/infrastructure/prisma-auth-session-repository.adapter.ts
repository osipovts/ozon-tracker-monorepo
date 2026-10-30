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
}
