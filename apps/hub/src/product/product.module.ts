import { Module } from '@nestjs/common';
import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import { ListMarketplaceSessionsUseCase } from '../browser-session/application/index.js';
import { BrowserSessionModule } from '../browser-session/browser-session.module.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { ScheduleJobUseCase } from '../job/application/index.js';
import { JobModule } from '../job/job.module.js';
import { ListBestProxyServersUseCase } from '../proxy/application/index.js';
import { ProxyModule } from '../proxy/proxy.module.js';
import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { RATE_LIMITER, type RateLimiterPort } from '../shared/application/rate-limiter.port.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import { AddProductUseCase } from './application/add-product.use-case.js';
import { ListPriceHistoryUseCase } from './application/list-price-history.use-case.js';
import { ListProductsUseCase } from './application/list-products.use-case.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepositoryPort,
} from './application/price-observation-repository.port.js';
import { RecordPriceResultUseCase } from './application/record-price-result.use-case.js';
import { RemoveProductUseCase } from './application/remove-product.use-case.js';
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
        observations: PriceObservationRepositoryPort,
        requestObservation: RequestPriceObservationUseCase,
        limiter: RateLimiterPort,
        config: AppConfigInterface,
        logger: LoggerPort,
      ): AddProductUseCase =>
        new AddProductUseCase(
          resolve,
          products,
          observations,
          requestObservation,
          limiter,
          {
            maxProducts: config.productsPerUserMax,
            add: { limit: config.productAddMaxAttempts, windowMs: config.productAddWindowMs },
          },
          logger.child('products'),
        ),
      inject: [
        ResolveProductReferenceUseCase,
        TRACKED_PRODUCT_REPOSITORY,
        PRICE_OBSERVATION_REPOSITORY,
        RequestPriceObservationUseCase,
        RATE_LIMITER,
        APP_CONFIG,
        LOGGER,
      ],
    },
    {
      provide: RemoveProductUseCase,
      useFactory: (products: TrackedProductRepositoryPort): RemoveProductUseCase =>
        new RemoveProductUseCase(products),
      inject: [TRACKED_PRODUCT_REPOSITORY],
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
        proxyServers: ListBestProxyServersUseCase,
        sessions: ListMarketplaceSessionsUseCase,
        scheduleJob: ScheduleJobUseCase,
        config: AppConfigInterface,
        logger: LoggerPort,
      ): RequestPriceObservationUseCase =>
        new RequestPriceObservationUseCase(
          products,
          proxyServers,
          sessions,
          scheduleJob,
          { proxyCount: config.priceProxyCount, timeoutMs: config.priceTimeoutMs },
          logger.child('products'),
        ),
      inject: [
        TRACKED_PRODUCT_REPOSITORY,
        ListBestProxyServersUseCase,
        ListMarketplaceSessionsUseCase,
        ScheduleJobUseCase,
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
