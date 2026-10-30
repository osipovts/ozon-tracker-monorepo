import type { PrismaClient, User as UserRow } from '../../generated/prisma/client.js';
import type { UserRepositoryPort } from '../application/user-repository.port.js';
import { UserEntity } from '../domain/user.entity.js';

function toEntity(row: UserRow): UserEntity {
  return new UserEntity({
    id: row.id,
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
  });
}

export class PrismaUserRepositoryAdapter implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async add(user: UserEntity): Promise<boolean> {
    // Skipping a duplicate instead of reading first keeps concurrent sign-ups apart.
    const { count } = await this.prisma.user.createMany({
      data: [user.snapshot],
      skipDuplicates: true,
    });

    return count > 0;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });

    return row === null ? null : toEntity(row);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });

    return row === null ? null : toEntity(row);
  }
}
