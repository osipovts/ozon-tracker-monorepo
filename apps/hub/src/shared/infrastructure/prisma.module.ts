import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { APP_CONFIG, type AppConfigInterface } from '../application/app-config.interface.js';

export const PRISMA = Symbol('PrismaClient');

/** The Postgres connection the repositories of every context share. */
@Module({
  providers: [
    {
      provide: PRISMA,
      useFactory: (config: AppConfigInterface): PrismaClient =>
        new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) }),
      inject: [APP_CONFIG],
    },
  ],
  exports: [PRISMA],
})
export class PrismaModule implements OnApplicationShutdown {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
