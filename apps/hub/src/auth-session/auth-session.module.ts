import { Module } from '@nestjs/common';

import { PrismaClient } from '../generated/prisma/client.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepositoryPort,
} from './application/auth-session-repository.port.js';
import { PrismaAuthSessionRepositoryAdapter } from './infrastructure/prisma-auth-session-repository.adapter.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: AUTH_SESSION_REPOSITORY,
      useFactory: (prisma: PrismaClient): AuthSessionRepositoryPort =>
        new PrismaAuthSessionRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
  ],
  exports: [AUTH_SESSION_REPOSITORY],
})
export class AuthSessionModule {}
