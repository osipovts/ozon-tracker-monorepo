import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { toPageResponse } from '../../shared/presentation/pagination-query.type.js';
import { routeAccess } from '../../shared/presentation/route-access.type.js';
import { DeleteProxyUseCase } from '../application/delete-proxy.use-case.js';
import { ListProxiesUseCase } from '../application/list-proxies.use-case.js';
import { SetProxyDisabledUseCase } from '../application/set-proxy-disabled.use-case.js';
import {
  proxyDisabledBodySchema,
  type ProxyDisabledBodyType,
  proxyListQuerySchema,
  type ProxyListQueryType,
  proxyListResponseSchema,
  type ProxyListResponseType,
  proxyServerQuerySchema,
  type ProxyServerQueryType,
} from './proxy-list.type.js';

@ApiBearerAuth()
@ApiTags('proxies')
@routeAccess('operator')
@Controller('proxies')
export class ProxiesController {
  constructor(
    @Inject(ListProxiesUseCase) private readonly listProxies: ListProxiesUseCase,
    @Inject(SetProxyDisabledUseCase) private readonly setDisabled: SetProxyDisabledUseCase,
    @Inject(DeleteProxyUseCase) private readonly deleteProxy: DeleteProxyUseCase,
  ) {}

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
        ...(query.alive === undefined ? {} : { alive: query.alive === 'true' }),
        ...(query.disabled === undefined ? {} : { disabled: query.disabled === 'true' }),
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
      disabled: proxy.snapshot.disabledAt !== null,
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

  @Patch()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Turn a proxy off or on',
    description:
      'A proxy that is off stays in the list but is not given to the workers, and a check does not turn it on. The server goes in the query: it has slashes.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'The proxy is unknown' })
  async setProxyDisabled(
    @Query({ schema: proxyServerQuerySchema }) query: ProxyServerQueryType,
    @Body({ schema: proxyDisabledBodySchema }) body: ProxyDisabledBodyType,
  ): Promise<void> {
    await this.setDisabled.execute(query.server, body.disabled);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a proxy',
    description:
      'The next refresh of its source finds it again if it is still listed there: turn it off instead to keep it away.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'The proxy is unknown' })
  async remove(
    @Query({ schema: proxyServerQuerySchema }) query: ProxyServerQueryType,
  ): Promise<void> {
    await this.deleteProxy.execute(query.server);
  }
}
