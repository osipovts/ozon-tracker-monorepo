import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ProxySourceType } from 'queue-contract';

import { RefreshProxySourceUseCase } from '../../application/proxy/refresh-proxy-source.use-case.js';
import {
  jobAcceptedResponseSchema,
  type JobAcceptedResponseType,
  proxySourceRefreshBodySchema,
  type ProxySourceRefreshBodyType,
  proxySourceSchema,
} from './proxy-source-refresh.type.js';

@ApiTags('proxies')
@Controller('proxy-sources')
export class ProxySourcesController {
  constructor(
    @Inject(RefreshProxySourceUseCase) private readonly refreshSource: RefreshProxySourceUseCase,
  ) {}

  @Post(':source/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue a refresh of the proxies of one source' })
  @ApiAcceptedResponse({ standardSchema: jobAcceptedResponseSchema })
  refresh(
    @Param('source', { schema: proxySourceSchema }) source: ProxySourceType,
    @Body({ schema: proxySourceRefreshBodySchema }) body: ProxySourceRefreshBodyType,
  ): Promise<JobAcceptedResponseType> {
    return this.refreshSource.execute(source, body);
  }
}
