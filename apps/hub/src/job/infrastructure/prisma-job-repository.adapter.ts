import { z } from 'zod';

import type { JobRecord as JobRow, PrismaClient } from '../../generated/prisma/client.js';
import {
  type PageInterface,
  pageOffset,
  type PaginationInterface,
} from '../../shared/application/page.interface.js';
import type {
  JobCountsType,
  JobFilterInterface,
  JobRepositoryPort,
} from '../application/job-repository.port.js';
import { JobEntity, jobKinds, jobStatuses } from '../domain/job.entity.js';

const kindSchema = z.enum(jobKinds);
const statusSchema = z.enum(jobStatuses);

function toEntity(row: JobRow): JobEntity {
  return new JobEntity({
    id: row.id,
    kind: kindSchema.parse(row.kind),
    subject: row.subject,
    requestedBy: row.requestedBy,
    status: statusSchema.parse(row.status),
    processed: row.processed,
    total: row.total,
    succeeded: row.succeeded,
    error: row.error,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  });
}

export class PrismaJobRepositoryAdapter implements JobRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async save(job: JobEntity): Promise<void> {
    const { id, ...data } = job.snapshot;
    await this.prisma.jobRecord.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  async countByStatus(since: Date): Promise<JobCountsType> {
    const groups = await this.prisma.jobRecord.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    const counts: JobCountsType = { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0 };
    for (const group of groups) counts[statusSchema.parse(group.status)] = group._count._all;

    return counts;
  }

  async findById(id: string): Promise<JobEntity | null> {
    const row = await this.prisma.jobRecord.findUnique({ where: { id } });

    return row === null ? null : toEntity(row);
  }

  async list(
    filter: JobFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<JobEntity>> {
    const where = {
      ...(filter.kind === undefined ? {} : { kind: filter.kind }),
      ...(filter.status === undefined ? {} : { status: filter.status }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.jobRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(pagination),
        take: pagination.pageSize,
      }),
      this.prisma.jobRecord.count({ where }),
    ]);

    return { items: rows.map(toEntity), total };
  }
}
