import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ListProxiesUseCase } from '../../application/proxy/list-proxies.use-case.js';
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
      { page: query.page, pageSize: query.pageSize },
    );
    return {
      items: page.items.map(({ proxy, session, ready }) => ({
        server: proxy.server,
        source: proxy.source,
        country: proxy.country,
        exitIp: proxy.exitIp,
        alive: proxy.alive,
        latencyMs: proxy.latencyMs,
        successRate: proxy.successRate,
        checksTotal: proxy.checksTotal,
        lastCheckedAt: proxy.lastCheckedAt.toISOString(),
        ready,
        session:
          session === null
            ? null
            : {
                id: session.snapshot.id,
                status: session.snapshot.status,
                staleReason: session.snapshot.staleReason,
                updatedAt: session.snapshot.updatedAt.toISOString(),
              },
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: page.total,
    };
  }
}
