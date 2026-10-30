import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { toPageResponse } from '../../shared/presentation/pagination-query.type.js';
import { ListProxiesUseCase } from '../application/list-proxies.use-case.js';
import {
  proxyListQuerySchema,
  type ProxyListQueryType,
  proxyListResponseSchema,
  type ProxyListResponseType,
} from './proxy-list.type.js';

@ApiTags('proxies')
@Controller('proxies')
export class ProxiesController {
  constructor(@Inject(ListProxiesUseCase) private readonly listProxies: ListProxiesUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'List proxies, the best first',
    description:
      'A proxy is ready when it has an active browser session of the marketplace; `ready=false` lists the ones that still need it.',
  })
  @ApiOkResponse({ standardSchema: proxyListResponseSchema })
  async list(
    @Query({ schema: proxyListQuerySchema }) query: ProxyListQueryType,
  ): Promise<ProxyListResponseType> {
    const page = await this.listProxies.execute(
      {
        alive: query.alive === 'true',
        ...(query.country === undefined ? {} : { country: query.country }),
        marketplace: query.marketplace,
        ...(query.ready === undefined ? {} : { ready: query.ready === 'true' }),
      },
      query,
    );

    return toPageResponse(page, query, ({ proxy, session, ready }) => ({
      server: proxy.snapshot.server,
      source: proxy.snapshot.source,
      country: proxy.snapshot.country,
      exitIp: proxy.snapshot.exitIp,
      alive: proxy.snapshot.alive,
      latencyMs: proxy.snapshot.latencyMs,
      successRate: proxy.successRate,
      checksTotal: proxy.snapshot.checksTotal,
      lastCheckedAt: proxy.snapshot.lastCheckedAt.toISOString(),
      ready,
      session:
        session === null
          ? null
          : {
              id: session.id,
              status: session.status,
              staleReason: session.staleReason,
              updatedAt: session.updatedAt.toISOString(),
            },
    }));
  }
}
