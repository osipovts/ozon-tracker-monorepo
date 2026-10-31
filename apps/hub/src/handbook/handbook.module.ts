import { Module } from '@nestjs/common';

import { PrismaClient } from '../generated/prisma/client.js';
import { ScheduleJobUseCase } from '../job/application/index.js';
import { JobModule } from '../job/job.module.js';
import { ListBestProxyServersUseCase } from '../proxy/application/index.js';
import { ProxyModule } from '../proxy/proxy.module.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { RATE_LIMITER, type RateLimiterPort } from '../shared/application/rate-limiter.port.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import { FindCityUseCase } from './application/find-city.use-case.js';
import {
  HANDBOOK_REPOSITORY,
  type HandbookRepositoryPort,
} from './application/handbook-repository.port.js';
import { RefreshHandbookUseCase } from './application/refresh-handbook.use-case.js';
import { SaveHandbookCitiesUseCase } from './application/save-handbook-cities.use-case.js';
import { SearchCitiesUseCase } from './application/search-cities.use-case.js';
import { PeriodicHandbookRefreshAdapter } from './infrastructure/periodic-handbook-refresh.adapter.js';
import { PrismaHandbookRepositoryAdapter } from './infrastructure/prisma-handbook-repository.adapter.js';
import { CitiesController } from './presentation/cities.controller.js';
import { HandbookResultsConsumer } from './presentation/handbook-results.consumer.js';
import { HandbooksController } from './presentation/handbooks.controller.js';

const day = 24 * 60 * 60_000;
/** A handbook is read again once it is a week old: the cities of a marketplace hardly change. */
const handbookMaxAgeMs = 7 * day;
/** How many of the best proxies a read of a handbook tries before the direct connection. */
const handbookProxyCount = 10;

@Module({
  imports: [PrismaModule, JobModule, ProxyModule],
  controllers: [CitiesController, HandbooksController],
  providers: [
    {
      provide: HANDBOOK_REPOSITORY,
      useFactory: (prisma: PrismaClient): HandbookRepositoryPort =>
        new PrismaHandbookRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: SaveHandbookCitiesUseCase,
      useFactory: (handbooks: HandbookRepositoryPort): SaveHandbookCitiesUseCase =>
        new SaveHandbookCitiesUseCase(handbooks),
      inject: [HANDBOOK_REPOSITORY],
    },
    {
      provide: SearchCitiesUseCase,
      useFactory: (handbooks: HandbookRepositoryPort): SearchCitiesUseCase =>
        new SearchCitiesUseCase(handbooks),
      inject: [HANDBOOK_REPOSITORY],
    },
    {
      provide: FindCityUseCase,
      useFactory: (handbooks: HandbookRepositoryPort): FindCityUseCase =>
        new FindCityUseCase(handbooks),
      inject: [HANDBOOK_REPOSITORY],
    },
    {
      provide: RefreshHandbookUseCase,
      useFactory: (
        proxyServers: ListBestProxyServersUseCase,
        scheduleJob: ScheduleJobUseCase,
      ): RefreshHandbookUseCase =>
        new RefreshHandbookUseCase(proxyServers, scheduleJob, handbookProxyCount),
      inject: [ListBestProxyServersUseCase, ScheduleJobUseCase],
    },
    {
      provide: PeriodicHandbookRefreshAdapter,
      useFactory: (
        refresh: RefreshHandbookUseCase,
        handbooks: HandbookRepositoryPort,
        limiter: RateLimiterPort,
        logger: LoggerPort,
      ): PeriodicHandbookRefreshAdapter =>
        new PeriodicHandbookRefreshAdapter(
          refresh,
          handbooks,
          limiter,
          { maxAgeMs: handbookMaxAgeMs, checkIntervalMs: day / 24 },
          logger.child('handbook-refresh'),
        ),
      inject: [RefreshHandbookUseCase, HANDBOOK_REPOSITORY, RATE_LIMITER, LOGGER],
    },
    HandbookResultsConsumer,
  ],
  exports: [FindCityUseCase],
})
export class HandbookModule {}
