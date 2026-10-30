import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import {
  BROWSER_SESSION_REPOSITORY,
  type BrowserSessionRepositoryPort,
} from '../browser-session/application/browser-session-repository.port.js';
import { PrismaBrowserSessionRepositoryAdapter } from '../browser-session/infrastructure/prisma-browser-session-repository.adapter.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { JOB_REPOSITORY, type JobRepositoryPort } from '../job/application/job-repository.port.js';
import { PrismaJobRepositoryAdapter } from '../job/infrastructure/prisma-job-repository.adapter.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepositoryPort,
} from '../product/application/price-observation-repository.port.js';
import {
  TRACKED_PRODUCT_REPOSITORY,
  type TrackedProductRepositoryPort,
} from '../product/application/tracked-product-repository.port.js';
import { PrismaPriceObservationRepositoryAdapter } from '../product/infrastructure/prisma-price-observation-repository.adapter.js';
import { PrismaTrackedProductRepositoryAdapter } from '../product/infrastructure/prisma-tracked-product-repository.adapter.js';
import {
  PROXY_REPOSITORY,
  type ProxyRepositoryPort,
} from '../proxy/application/proxy-repository.port.js';
import { PrismaProxyRepositoryAdapter } from '../proxy/infrastructure/prisma-proxy-repository.adapter.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../shared/infrastructure/app-config.interface.js';

const PRISMA = Symbol('PrismaClient');

/** The repositories of every domain, all stored in Postgres. */
@Module({
  providers: [
    {
      provide: PRISMA,
      useFactory: (config: AppConfigInterface): PrismaClient =>
        new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) }),
      inject: [APP_CONFIG],
    },
    {
      provide: PROXY_REPOSITORY,
      useFactory: (prisma: PrismaClient): ProxyRepositoryPort =>
        new PrismaProxyRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: TRACKED_PRODUCT_REPOSITORY,
      useFactory: (prisma: PrismaClient): TrackedProductRepositoryPort =>
        new PrismaTrackedProductRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: PRICE_OBSERVATION_REPOSITORY,
      useFactory: (prisma: PrismaClient): PriceObservationRepositoryPort =>
        new PrismaPriceObservationRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: JOB_REPOSITORY,
      useFactory: (prisma: PrismaClient): JobRepositoryPort =>
        new PrismaJobRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: BROWSER_SESSION_REPOSITORY,
      useFactory: (prisma: PrismaClient): BrowserSessionRepositoryPort =>
        new PrismaBrowserSessionRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
  ],
  exports: [
    PROXY_REPOSITORY,
    TRACKED_PRODUCT_REPOSITORY,
    PRICE_OBSERVATION_REPOSITORY,
    JOB_REPOSITORY,
    BROWSER_SESSION_REPOSITORY,
  ],
})
export class PersistenceModule implements OnApplicationShutdown {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
