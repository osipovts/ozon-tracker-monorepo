import { Module } from '@nestjs/common';

import { GetJobUseCase } from '../application/job/get-job.use-case.js';
import { JOB_REPOSITORY, type JobRepositoryPort } from '../application/job/job-repository.port.js';
import { ListJobsUseCase } from '../application/job/list-jobs.use-case.js';
import { RecordJobEventUseCase } from '../application/job/record-job-event.use-case.js';
import { LOGGER, type LoggerPort } from '../application/shared/logger.port.js';
import { JobsController } from '../presentation/job/jobs.controller.js';
import { PersistenceModule } from './persistence.module.js';

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
