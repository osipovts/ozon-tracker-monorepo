import { Module } from '@nestjs/common';

import { JOB_QUEUE, type JobQueuePort } from '../application/job/job-queue.port.js';
import { JOB_REPOSITORY, type JobRepositoryPort } from '../application/job/job-repository.port.js';
import { ListProxiesUseCase } from '../application/proxy/list-proxies.use-case.js';
import {
  PROXY_REPOSITORY,
  type ProxyRepositoryPort,
} from '../application/proxy/proxy-repository.port.js';
import { RecordProxyChecksUseCase } from '../application/proxy/record-proxy-checks.use-case.js';
import { RefreshProxySourceUseCase } from '../application/proxy/refresh-proxy-source.use-case.js';
import {
  BROWSER_SESSION_REPOSITORY,
  type BrowserSessionRepositoryPort,
} from '../application/session/browser-session-repository.port.js';
import { LOGGER, type LoggerPort } from '../application/shared/logger.port.js';
import { ProxiesController } from '../presentation/proxy/proxies.controller.js';
import { ProxyResultsConsumer } from '../presentation/proxy/proxy-results.consumer.js';
import { ProxySourcesController } from '../presentation/proxy/proxy-sources.controller.js';
import { JobModule } from './job.module.js';
import { PersistenceModule } from './persistence.module.js';
import { QueueModule } from './queue.module.js';

@Module({
  imports: [PersistenceModule, QueueModule, JobModule],
  controllers: [ProxiesController, ProxySourcesController],
  providers: [
    {
      provide: RefreshProxySourceUseCase,
      useFactory: (
        queue: JobQueuePort,
        jobs: JobRepositoryPort,
        logger: LoggerPort,
      ): RefreshProxySourceUseCase =>
        new RefreshProxySourceUseCase(queue, jobs, logger.child('proxies')),
      inject: [JOB_QUEUE, JOB_REPOSITORY, LOGGER],
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
      provide: RecordProxyChecksUseCase,
      useFactory: (proxies: ProxyRepositoryPort, logger: LoggerPort): RecordProxyChecksUseCase =>
        new RecordProxyChecksUseCase(proxies, logger.child('proxy-checks')),
      inject: [PROXY_REPOSITORY, LOGGER],
    },
    ProxyResultsConsumer,
  ],
})
export class ProxyModule {}
