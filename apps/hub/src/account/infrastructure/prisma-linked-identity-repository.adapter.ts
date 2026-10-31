import { z } from 'zod';

import type {
  LinkedIdentity as LinkedIdentityRow,
  PrismaClient,
} from '../../generated/prisma/client.js';
import type { LinkedIdentityRepositoryPort } from '../application/linked-identity-repository.port.js';
import { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import { oauthProviders, type OauthProviderType } from '../domain/oauth-provider.type.js';

const providerSchema = z.enum(oauthProviders);

function toEntity(row: LinkedIdentityRow): LinkedIdentityEntity {
  return new LinkedIdentityEntity({
    id: row.id,
    userId: row.userId,
    provider: providerSchema.parse(row.provider),
    subject: row.subject,
    createdAt: row.createdAt,
  });
}

export class PrismaLinkedIdentityRepositoryAdapter implements LinkedIdentityRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async add(identity: LinkedIdentityEntity): Promise<boolean> {
    // Skipping a duplicate instead of reading first keeps concurrent links apart.
    const { count } = await this.prisma.linkedIdentity.createMany({
      data: [identity.snapshot],
      skipDuplicates: true,
    });

    return count > 0;
  }

  async listByUser(userId: string): Promise<LinkedIdentityEntity[]> {
    const rows = await this.prisma.linkedIdentity.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(toEntity);
  }

  async remove(userId: string, provider: OauthProviderType): Promise<boolean> {
    const { count } = await this.prisma.linkedIdentity.deleteMany({ where: { userId, provider } });

    return count > 0;
  }

  async findByProviderSubject(
    provider: OauthProviderType,
    subject: string,
  ): Promise<LinkedIdentityEntity | null> {
    const row = await this.prisma.linkedIdentity.findUnique({
      where: { providerSubject: { provider, subject } },
    });

    return row === null ? null : toEntity(row);
  }
}
