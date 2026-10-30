import { Module } from '@nestjs/common';
import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import {
  BROWSER_SESSION_REPOSITORY,
  type BrowserSessionRepositoryPort,
} from '../browser-session/application/browser-session-repository.port.js';
import { BrowserSessionModule } from '../browser-session/browser-session.module.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { JOB_QUEUE, type JobQueuePort } from '../job/application/job-queue.port.js';
import { JOB_REPOSITORY, type JobRepositoryPort } from '../job/application/job-repository.port.js';
import { JobModule } from '../job/job.module.js';
import {
  PROXY_REPOSITORY,
  type ProxyRepositoryPort,
} from '../proxy/application/proxy-repository.port.js';
import { ProxyModule } from '../proxy/proxy.module.js';
import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import { AddProductUseCase } from './application/add-product.use-case.js';
import { ListPriceHistoryUseCase } from './application/list-price-history.use-case.js';
import { ListProductsUseCase } from './application/list-products.use-case.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepositoryPort,
} from './application/price-observation-repository.port.js';
import { RecordPriceResultUseCase } from './application/record-price-result.use-case.js';
import { RequestPriceObservationUseCase } from './application/request-price-observation.use-case.js';
import {
  TRACKED_PRODUCT_REPOSITORY,
  type TrackedProductRepositoryPort,
} from './application/tracked-product-repository.port.js';
import { PrismaPriceObservationRepositoryAdapter } from './infrastructure/prisma-price-observation-repository.adapter.js';
import { PrismaTrackedProductRepositoryAdapter } from './infrastructure/prisma-tracked-product-repository.adapter.js';
import { PriceResultsConsumer } from './presentation/price-results.consumer.js';
import { ProductsController } from './presentation/products.controller.js';

@Module({
  imports: [PrismaModule, JobModule, BrowserSessionModule, ProxyModule],
  controllers: [ProductsController],
  providers: [
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
      provide: ResolveProductReferenceUseCase,
      useFactory: (): ResolveProductReferenceUseCase =>
        new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
    },
    {
      provide: AddProductUseCase,
      useFactory: (
        resolve: ResolveProductReferenceUseCase,
        products: TrackedProductRepositoryPort,
        logger: LoggerPort,
      ): AddProductUseCase => new AddProductUseCase(resolve, products, logger.child('products')),
      inject: [ResolveProductReferenceUseCase, TRACKED_PRODUCT_REPOSITORY, LOGGER],
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
        config: AppConfigInterface,
        logger: LoggerPort,
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
        APP_CONFIG,
        LOGGER,
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
      provide: RecordPriceResultUseCase,
      useFactory: (
        products: TrackedProductRepositoryPort,
        observations: PriceObservationRepositoryPort,
        logger: LoggerPort,
      ): RecordPriceResultUseCase =>
        new RecordPriceResultUseCase(products, observations, logger.child('price-results')),
      inject: [TRACKED_PRODUCT_REPOSITORY, PRICE_OBSERVATION_REPOSITORY, LOGGER],
    },
    PriceResultsConsumer,
  ],
})
export class ProductModule {}
