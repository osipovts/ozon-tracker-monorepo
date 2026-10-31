import type {
  EmailVerification as EmailVerificationRow,
  PrismaClient,
} from '../../generated/prisma/client.js';
import type { EmailVerificationRepositoryPort } from '../application/email-verification-repository.port.js';
import { EmailVerificationEntity } from '../domain/email-verification.entity.js';

function toEntity(row: EmailVerificationRow): EmailVerificationEntity {
  return new EmailVerificationEntity({
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  });
}

export class PrismaEmailVerificationRepositoryAdapter implements EmailVerificationRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async replaceForUser(verification: EmailVerificationEntity): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.emailVerification.deleteMany({ where: { userId: verification.snapshot.userId } }),
      this.prisma.emailVerification.create({ data: verification.snapshot }),
    ]);
  }

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationEntity | null> {
    const row = await this.prisma.emailVerification.findUnique({ where: { tokenHash } });

    return row === null ? null : toEntity(row);
  }
}
