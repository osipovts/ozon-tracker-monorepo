import { Module } from '@nestjs/common';

import { PrismaClient } from '../generated/prisma/client.js';
import { GetJobActivityUseCase, ScheduleJobUseCase } from '../job/application/index.js';
import { JobModule } from '../job/job.module.js';
import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { RATE_LIMITER, type RateLimiterPort } from '../shared/application/rate-limiter.port.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import { AddManualProxyUseCase } from './application/add-manual-proxy.use-case.js';
import { DeleteAllProxiesUseCase } from './application/delete-all-proxies.use-case.js';
import { DeleteProxyUseCase } from './application/delete-proxy.use-case.js';
import { GetProxyStatsUseCase } from './application/get-proxy-stats.use-case.js';
import { ListBestProxyServersUseCase } from './application/list-best-proxy-servers.use-case.js';
import { ListProxiesUseCase } from './application/list-proxies.use-case.js';
import { PROXY_REPOSITORY, type ProxyRepositoryPort } from './application/proxy-repository.port.js';
import { RecordProxyChecksUseCase } from './application/record-proxy-checks.use-case.js';
import { RefreshProxySourceUseCase } from './application/refresh-proxy-source.use-case.js';
import { SetProxyDisabledUseCase } from './application/set-proxy-disabled.use-case.js';
import { PeriodicProxyRefreshAdapter } from './infrastructure/periodic-proxy-refresh.adapter.js';
import { PrismaProxyRepositoryAdapter } from './infrastructure/prisma-proxy-repository.adapter.js';
import { ProxiesController } from './presentation/proxies.controller.js';
import { ProxyResultsConsumer } from './presentation/proxy-results.consumer.js';
import { ProxySourcesController } from './presentation/proxy-sources.controller.js';

@Module({
  imports: [PrismaModule, JobModule],
  controllers: [ProxiesController, ProxySourcesController],
  providers: [
    {
      provide: PROXY_REPOSITORY,
      useFactory: (prisma: PrismaClient): ProxyRepositoryPort =>
        new PrismaProxyRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: RefreshProxySourceUseCase,
      useFactory: (
        scheduleJob: ScheduleJobUseCase,
        logger: LoggerPort,
      ): RefreshProxySourceUseCase =>
        new RefreshProxySourceUseCase(scheduleJob, logger.child('proxies')),
      inject: [ScheduleJobUseCase, LOGGER],
    },
    {
      provide: PeriodicProxyRefreshAdapter,
      useFactory: (
        refresh: RefreshProxySourceUseCase,
        activity: GetJobActivityUseCase,
        limiter: RateLimiterPort,
        config: AppConfigInterface,
        logger: LoggerPort,
      ): PeriodicProxyRefreshAdapter =>
        new PeriodicProxyRefreshAdapter(
          refresh,
          activity,
          limiter,
          {
            pauseMs: config.proxyRefreshPauseMinutes * 60_000,
            pollMs: 60_000,
            maxCandidates: config.proxyRefreshMaxCandidates,
            probeTimeoutMs: config.proxyRefreshProbeTimeoutMs,
          },
          logger.child('proxy-refresh'),
        ),
      inject: [RefreshProxySourceUseCase, GetJobActivityUseCase, RATE_LIMITER, APP_CONFIG, LOGGER],
    },
    {
      provide: ListProxiesUseCase,
      useFactory: (proxies: ProxyRepositoryPort): ListProxiesUseCase =>
        new ListProxiesUseCase(proxies),
      inject: [PROXY_REPOSITORY],
    },
    {
      provide: AddManualProxyUseCase,
      useFactory: (proxies: ProxyRepositoryPort): AddManualProxyUseCase =>
        new AddManualProxyUseCase(proxies),
      inject: [PROXY_REPOSITORY],
    },
    {
      provide: SetProxyDisabledUseCase,
      useFactory: (proxies: ProxyRepositoryPort): SetProxyDisabledUseCase =>
        new SetProxyDisabledUseCase(proxies),
      inject: [PROXY_REPOSITORY],
    },
    {
      provide: GetProxyStatsUseCase,
      useFactory: (proxies: ProxyRepositoryPort): GetProxyStatsUseCase =>
        new GetProxyStatsUseCase(proxies),
      inject: [PROXY_REPOSITORY],
    },
    {
      provide: DeleteProxyUseCase,
      useFactory: (proxies: ProxyRepositoryPort): DeleteProxyUseCase =>
        new DeleteProxyUseCase(proxies),
      inject: [PROXY_REPOSITORY],
    },
    {
      provide: DeleteAllProxiesUseCase,
      useFactory: (proxies: ProxyRepositoryPort): DeleteAllProxiesUseCase =>
        new DeleteAllProxiesUseCase(proxies),
      inject: [PROXY_REPOSITORY],
    },
    {
      provide: ListBestProxyServersUseCase,
      useFactory: (proxies: ProxyRepositoryPort): ListBestProxyServersUseCase =>
        new ListBestProxyServersUseCase(proxies),
      inject: [PROXY_REPOSITORY],
    },
    {
      provide: RecordProxyChecksUseCase,
      useFactory: (proxies: ProxyRepositoryPort, logger: LoggerPort): RecordProxyChecksUseCase =>
        new RecordProxyChecksUseCase(proxies, logger.child('proxy-checks')),
      inject: [PROXY_REPOSITORY, LOGGER],
    },
    ProxyResultsConsumer,
  ],
  exports: [ListBestProxyServersUseCase, GetProxyStatsUseCase],
})
export class ProxyModule {}
