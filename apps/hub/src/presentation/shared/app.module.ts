import {
  type DynamicModule,
  Inject,
  Module,
  type OnApplicationShutdown,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import type { LoggerPort } from 'logger';
import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import { GetJobUseCase } from '../../application/job/get-job.use-case.js';
import { JOB_QUEUE, type JobQueuePort } from '../../application/job/job-queue.port.js';
import {
  JOB_REPOSITORY,
  type JobRepositoryPort,
} from '../../application/job/job-repository.port.js';
import { ListJobsUseCase } from '../../application/job/list-jobs.use-case.js';
import { RecordJobEventUseCase } from '../../application/job/record-job-event.use-case.js';
import { AddProductUseCase } from '../../application/product/add-product.use-case.js';
import { ListPriceHistoryUseCase } from '../../application/product/list-price-history.use-case.js';
import { ListProductsUseCase } from '../../application/product/list-products.use-case.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepositoryPort,
} from '../../application/product/price-observation-repository.port.js';
import { RecordPriceResultUseCase } from '../../application/product/record-price-result.use-case.js';
import { RequestPriceObservationUseCase } from '../../application/product/request-price-observation.use-case.js';
import {
  TRACKED_PRODUCT_REPOSITORY,
  type TrackedProductRepositoryPort,
} from '../../application/product/tracked-product-repository.port.js';
import { ListProxiesUseCase } from '../../application/proxy/list-proxies.use-case.js';
import {
  PROXY_REPOSITORY,
  type ProxyRepositoryPort,
} from '../../application/proxy/proxy-repository.port.js';
import { RecordProxyChecksUseCase } from '../../application/proxy/record-proxy-checks.use-case.js';
import { RefreshProxySourceUseCase } from '../../application/proxy/refresh-proxy-source.use-case.js';
import {
  BROWSER_SESSION_REPOSITORY,
  type BrowserSessionRepositoryPort,
} from '../../application/session/browser-session-repository.port.js';
import { DeleteSessionUseCase } from '../../application/session/delete-session.use-case.js';
import { ImportSessionUseCase } from '../../application/session/import-session.use-case.js';
import { ListSessionsUseCase } from '../../application/session/list-sessions.use-case.js';
import { RecordSessionEventUseCase } from '../../application/session/record-session-event.use-case.js';
import { LOGGER } from '../../application/shared/logger.port.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { BullmqJobQueueAdapter } from '../../infrastructure/job/bullmq-job-queue.adapter.js';
import { PrismaJobRepositoryAdapter } from '../../infrastructure/job/prisma-job-repository.adapter.js';
import { PrismaPriceObservationRepositoryAdapter } from '../../infrastructure/product/prisma-price-observation-repository.adapter.js';
import { PrismaTrackedProductRepositoryAdapter } from '../../infrastructure/product/prisma-tracked-product-repository.adapter.js';
import { PrismaProxyRepositoryAdapter } from '../../infrastructure/proxy/prisma-proxy-repository.adapter.js';
import { PrismaBrowserSessionRepositoryAdapter } from '../../infrastructure/session/prisma-browser-session-repository.adapter.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../infrastructure/shared/app-config.interface.js';
import { JobsController } from '../job/jobs.controller.js';
import { PriceResultsConsumer } from '../product/price-results.consumer.js';
import { ProductsController } from '../product/products.controller.js';
import { ProxiesController } from '../proxy/proxies.controller.js';
import { ProxyResultsConsumer } from '../proxy/proxy-results.consumer.js';
import { ProxySourcesController } from '../proxy/proxy-sources.controller.js';
import { SessionsController } from '../session/sessions.controller.js';
import { ApplicationErrorFilter } from './application-error.filter.js';
import { HttpLoggingInterceptor } from './http-logging.interceptor.js';

const PRISMA = Symbol('PrismaClient');

@Module({})
export class AppModule implements OnApplicationShutdown {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  static register(config: AppConfigInterface, logger: LoggerPort): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        ProxiesController,
        ProxySourcesController,
        ProductsController,
        JobsController,
        SessionsController,
      ],
      providers: [
        { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
        { provide: APP_FILTER, useClass: ApplicationErrorFilter },
        { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
        { provide: APP_CONFIG, useValue: config },
        { provide: LOGGER, useValue: logger },
        {
          provide: PRISMA,
          useFactory: (): PrismaClient =>
            new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) }),
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
        {
          provide: JOB_QUEUE,
          useFactory: (): JobQueuePort =>
            new BullmqJobQueueAdapter(config.redisUrl, logger.child('queue')),
        },
        {
          provide: ResolveProductReferenceUseCase,
          useFactory: (): ResolveProductReferenceUseCase =>
            new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
        },
        {
          provide: RefreshProxySourceUseCase,
          useFactory: (queue: JobQueuePort, jobs: JobRepositoryPort): RefreshProxySourceUseCase =>
            new RefreshProxySourceUseCase(queue, jobs, logger.child('proxies')),
          inject: [JOB_QUEUE, JOB_REPOSITORY],
        },
        {
          provide: ListProxiesUseCase,
          useFactory: (
            proxies: ProxyRepositoryPort,
            sessions: BrowserSessionRepositoryPort,
          ): ListProxiesUseCase => new ListProxiesUseCase(proxies, sessions),
          inject: [PROXY_REPOSITORY, BROWSER_SESSION_REPOSITORY],
        },
        {
          provide: AddProductUseCase,
          useFactory: (
            resolve: ResolveProductReferenceUseCase,
            products: TrackedProductRepositoryPort,
          ): AddProductUseCase =>
            new AddProductUseCase(resolve, products, logger.child('products')),
          inject: [ResolveProductReferenceUseCase, TRACKED_PRODUCT_REPOSITORY],
        },
        {
          provide: ListProductsUseCase,
          useFactory: (
            products: TrackedProductRepositoryPort,
            observations: PriceObservationRepositoryPort,
          ): ListProductsUseCase => new ListProductsUseCase(products, observations),
          inject: [TRACKED_PRODUCT_REPOSITORY, PRICE_OBSERVATION_REPOSITORY],
        },
        {
          provide: RequestPriceObservationUseCase,
          useFactory: (
            products: TrackedProductRepositoryPort,
            proxies: ProxyRepositoryPort,
            sessions: BrowserSessionRepositoryPort,
            queue: JobQueuePort,
            jobs: JobRepositoryPort,
          ): RequestPriceObservationUseCase =>
            new RequestPriceObservationUseCase(
              products,
              proxies,
              sessions,
              queue,
              jobs,
              { proxyCount: config.priceProxyCount, timeoutMs: config.priceTimeoutMs },
              logger.child('products'),
            ),
          inject: [
            TRACKED_PRODUCT_REPOSITORY,
            PROXY_REPOSITORY,
            BROWSER_SESSION_REPOSITORY,
            JOB_QUEUE,
            JOB_REPOSITORY,
          ],
        },
        {
          provide: ListPriceHistoryUseCase,
          useFactory: (
            products: TrackedProductRepositoryPort,
            observations: PriceObservationRepositoryPort,
          ): ListPriceHistoryUseCase => new ListPriceHistoryUseCase(products, observations),
          inject: [TRACKED_PRODUCT_REPOSITORY, PRICE_OBSERVATION_REPOSITORY],
        },
        {
          provide: RecordProxyChecksUseCase,
          useFactory: (proxies: ProxyRepositoryPort): RecordProxyChecksUseCase =>
            new RecordProxyChecksUseCase(proxies, logger.child('proxy-checks')),
          inject: [PROXY_REPOSITORY],
        },
        {
          provide: RecordPriceResultUseCase,
          useFactory: (
            products: TrackedProductRepositoryPort,
            observations: PriceObservationRepositoryPort,
          ): RecordPriceResultUseCase =>
            new RecordPriceResultUseCase(products, observations, logger.child('price-results')),
          inject: [TRACKED_PRODUCT_REPOSITORY, PRICE_OBSERVATION_REPOSITORY],
        },
        {
          provide: RecordJobEventUseCase,
          useFactory: (jobs: JobRepositoryPort): RecordJobEventUseCase =>
            new RecordJobEventUseCase(jobs, logger.child('jobs')),
          inject: [JOB_REPOSITORY],
        },
        {
          provide: GetJobUseCase,
          useFactory: (jobs: JobRepositoryPort): GetJobUseCase => new GetJobUseCase(jobs),
          inject: [JOB_REPOSITORY],
        },
        {
          provide: ListJobsUseCase,
          useFactory: (jobs: JobRepositoryPort): ListJobsUseCase => new ListJobsUseCase(jobs),
          inject: [JOB_REPOSITORY],
        },
        {
          provide: ImportSessionUseCase,
          useFactory: (sessions: BrowserSessionRepositoryPort): ImportSessionUseCase =>
            new ImportSessionUseCase(sessions, logger.child('sessions')),
          inject: [BROWSER_SESSION_REPOSITORY],
        },
        {
          provide: ListSessionsUseCase,
          useFactory: (sessions: BrowserSessionRepositoryPort): ListSessionsUseCase =>
            new ListSessionsUseCase(sessions),
          inject: [BROWSER_SESSION_REPOSITORY],
        },
        {
          provide: DeleteSessionUseCase,
          useFactory: (sessions: BrowserSessionRepositoryPort): DeleteSessionUseCase =>
            new DeleteSessionUseCase(sessions, logger.child('sessions')),
          inject: [BROWSER_SESSION_REPOSITORY],
        },
        {
          provide: RecordSessionEventUseCase,
          useFactory: (sessions: BrowserSessionRepositoryPort): RecordSessionEventUseCase =>
            new RecordSessionEventUseCase(sessions, logger.child('sessions')),
          inject: [BROWSER_SESSION_REPOSITORY],
        },
        ProxyResultsConsumer,
        PriceResultsConsumer,
      ],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
