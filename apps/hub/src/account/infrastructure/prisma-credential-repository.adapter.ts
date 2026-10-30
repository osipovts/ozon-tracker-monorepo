import type { Credential as CredentialRow, PrismaClient } from '../../generated/prisma/client.js';
import type { CredentialRepositoryPort } from '../application/credential-repository.port.js';
import { CredentialEntity } from '../domain/credential.entity.js';

function toEntity(row: CredentialRow): CredentialEntity {
  return new CredentialEntity({ userId: row.userId, passwordHash: row.passwordHash });
}

export class PrismaCredentialRepositoryAdapter implements CredentialRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async save(credential: CredentialEntity): Promise<void> {
    const { userId, passwordHash } = credential.snapshot;
    await this.prisma.credential.upsert({
      where: { userId },
      create: { userId, passwordHash },
      update: { passwordHash },
    });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.credential.deleteMany({ where: { userId } });
  }

  async findByUserId(userId: string): Promise<CredentialEntity | null> {
    const row = await this.prisma.credential.findUnique({ where: { userId } });

    return row === null ? null : toEntity(row);
  }
}
