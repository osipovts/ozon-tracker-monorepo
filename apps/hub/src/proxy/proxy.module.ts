import { Module } from '@nestjs/common';

import {
  BROWSER_SESSION_REPOSITORY,
  type BrowserSessionRepositoryPort,
} from '../browser-session/application/browser-session-repository.port.js';
import { PersistenceModule } from '../composition/persistence.module.js';
import { QueueModule } from '../composition/queue.module.js';
import { JOB_QUEUE, type JobQueuePort } from '../job/application/job-queue.port.js';
import { JOB_REPOSITORY, type JobRepositoryPort } from '../job/application/job-repository.port.js';
import { JobModule } from '../job/job.module.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { ListProxiesUseCase } from './application/list-proxies.use-case.js';
import { PROXY_REPOSITORY, type ProxyRepositoryPort } from './application/proxy-repository.port.js';
import { RecordProxyChecksUseCase } from './application/record-proxy-checks.use-case.js';
import { RefreshProxySourceUseCase } from './application/refresh-proxy-source.use-case.js';
import { ProxiesController } from './presentation/proxies.controller.js';
import { ProxyResultsConsumer } from './presentation/proxy-results.consumer.js';
import { ProxySourcesController } from './presentation/proxy-sources.controller.js';

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
