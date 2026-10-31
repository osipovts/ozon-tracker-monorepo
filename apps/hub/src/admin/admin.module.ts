import { Module } from '@nestjs/common';

import { AccountModule } from '../account/account.module.js';
import { GetUserStatsUseCase } from '../account/application/index.js';
import { GetJobStatsUseCase } from '../job/application/index.js';
import { JobModule } from '../job/job.module.js';
import { GetProductStatsUseCase } from '../product/application/index.js';
import { ProductModule } from '../product/product.module.js';
import { GetProxyStatsUseCase } from '../proxy/application/index.js';
import { ProxyModule } from '../proxy/proxy.module.js';
import { GetDashboardUseCase } from './application/get-dashboard.use-case.js';
import { AdminController } from './presentation/admin.controller.js';

@Module({
  imports: [AccountModule, ProductModule, ProxyModule, JobModule],
  controllers: [AdminController],
  providers: [
    {
      provide: GetDashboardUseCase,
      useFactory: (
        users: GetUserStatsUseCase,
        products: GetProductStatsUseCase,
        proxies: GetProxyStatsUseCase,
        jobs: GetJobStatsUseCase,
      ): GetDashboardUseCase => new GetDashboardUseCase(users, products, proxies, jobs),
      inject: [
        GetUserStatsUseCase,
        GetProductStatsUseCase,
        GetProxyStatsUseCase,
        GetJobStatsUseCase,
      ],
    },
  ],
})
export class AdminModule {}
