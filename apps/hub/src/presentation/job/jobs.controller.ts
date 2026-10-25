import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GetJobUseCase } from '../../application/job/get-job.use-case.js';
import { ListJobsUseCase } from '../../application/job/list-jobs.use-case.js';
import type { JobEntity } from '../../domain/job/job.entity.js';
import { toPageResponse } from '../shared/pagination-query.type.js';
import {
  jobIdParamSchema,
  jobListQuerySchema,
  type JobListQueryType,
  jobListResponseSchema,
  type JobListResponseType,
  jobSchema,
  type JobType,
} from './job.type.js';

function toJob(job: JobEntity): JobType {
  const { createdAt, startedAt, finishedAt, ...rest } = job.snapshot;

  return {
    ...rest,
    percent: job.percent,
    createdAt: createdAt.toISOString(),
    startedAt: startedAt?.toISOString() ?? null,
    finishedAt: finishedAt?.toISOString() ?? null,
  };
}

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    @Inject(GetJobUseCase) private readonly getJob: GetJobUseCase,
    @Inject(ListJobsUseCase) private readonly listJobs: ListJobsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List jobs, the newest first' })
  @ApiOkResponse({ standardSchema: jobListResponseSchema })
  async list(
    @Query({ schema: jobListQuerySchema }) query: JobListQueryType,
  ): Promise<JobListResponseType> {
    const page = await this.listJobs.execute(
      {
        ...(query.kind === undefined ? {} : { kind: query.kind }),
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      query,
    );

    return toPageResponse(page, query, toJob);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Status and progress of a job; poll it for a progress bar' })
  @ApiOkResponse({ standardSchema: jobSchema })
  @ApiNotFoundResponse({ description: 'The job is unknown' })
  async get(@Param('id', { schema: jobIdParamSchema }) id: string): Promise<JobType> {
    return toJob(await this.getJob.execute(id));
  }
}
