import { Controller, Get, Inject } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { routeAccess } from '../../shared/presentation/route-access.type.js';
import { GetDashboardUseCase } from '../application/get-dashboard.use-case.js';
import { dashboardResponseSchema, type DashboardResponseType } from './dashboard.type.js';

@ApiTags('admin')
@routeAccess('admin')
@Controller('admin')
export class AdminController {
  constructor(@Inject(GetDashboardUseCase) private readonly getDashboard: GetDashboardUseCase) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'The figures of the hub on one page',
    description: 'Users, products, proxies, browser sessions and jobs. For administrators.',
  })
  @ApiOkResponse({ standardSchema: dashboardResponseSchema })
  @ApiForbiddenResponse({ description: 'The user is not an administrator' })
  async dashboard(): Promise<DashboardResponseType> {
    const { generatedAt, proxies, jobs, ...rest } = await this.getDashboard.execute();

    return {
      generatedAt: generatedAt.toISOString(),
      ...rest,
      proxies: { ...proxies, lastCheckedAt: proxies.lastCheckedAt?.toISOString() ?? null },
      jobs: {
        lastDay: jobs.lastDay,
        recentFailures: jobs.recentFailures.map((failure) => ({
          ...failure,
          finishedAt: failure.finishedAt?.toISOString() ?? null,
        })),
      },
    };
  }
}
