import { Module } from '@nestjs/common';

import { PersistenceModule } from '../composition/persistence.module.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { GetJobUseCase } from './application/get-job.use-case.js';
import { JOB_REPOSITORY, type JobRepositoryPort } from './application/job-repository.port.js';
import { ListJobsUseCase } from './application/list-jobs.use-case.js';
import { RecordJobEventUseCase } from './application/record-job-event.use-case.js';
import { JobsController } from './presentation/jobs.controller.js';

@Module({
  imports: [PersistenceModule],
  controllers: [JobsController],
  providers: [
    {
      provide: RecordJobEventUseCase,
      useFactory: (jobs: JobRepositoryPort, logger: LoggerPort): RecordJobEventUseCase =>
        new RecordJobEventUseCase(jobs, logger.child('jobs')),
      inject: [JOB_REPOSITORY, LOGGER],
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
  ],
  exports: [RecordJobEventUseCase],
})
export class JobModule {}
