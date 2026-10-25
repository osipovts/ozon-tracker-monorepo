import { Module } from '@nestjs/common';
import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import { JOB_QUEUE, type JobQueuePort } from '../application/job/job-queue.port.js';
import { JOB_REPOSITORY, type JobRepositoryPort } from '../application/job/job-repository.port.js';
import { AddProductUseCase } from '../application/product/add-product.use-case.js';
import { ListPriceHistoryUseCase } from '../application/product/list-price-history.use-case.js';
import { ListProductsUseCase } from '../application/product/list-products.use-case.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepositoryPort,
} from '../application/product/price-observation-repository.port.js';
import { RecordPriceResultUseCase } from '../application/product/record-price-result.use-case.js';
import { RequestPriceObservationUseCase } from '../application/product/request-price-observation.use-case.js';
import {
  TRACKED_PRODUCT_REPOSITORY,
  type TrackedProductRepositoryPort,
} from '../application/product/tracked-product-repository.port.js';
import {
  PROXY_REPOSITORY,
  type ProxyRepositoryPort,
} from '../application/proxy/proxy-repository.port.js';
import {
  BROWSER_SESSION_REPOSITORY,
  type BrowserSessionRepositoryPort,
} from '../application/session/browser-session-repository.port.js';
import { LOGGER, type LoggerPort } from '../application/shared/logger.port.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../infrastructure/shared/app-config.interface.js';
import { PriceResultsConsumer } from '../presentation/product/price-results.consumer.js';
import { ProductsController } from '../presentation/product/products.controller.js';
import { JobModule } from './job.module.js';
import { PersistenceModule } from './persistence.module.js';
import { QueueModule } from './queue.module.js';
import { SessionModule } from './session.module.js';

@Module({
  imports: [PersistenceModule, QueueModule, JobModule, SessionModule],
  controllers: [ProductsController],
  providers: [
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
