import { Controller, HttpCode, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { handbookSchema, type HandbookType } from 'queue-contract';

import {
  jobAcceptedResponseSchema,
  type JobAcceptedResponseType,
} from '../../shared/presentation/job-accepted.type.js';
import { findIdentity } from '../../shared/presentation/request-identity.type.js';
import { routeAccess } from '../../shared/presentation/route-access.type.js';
import { RefreshHandbookUseCase } from '../application/refresh-handbook.use-case.js';

@ApiBearerAuth()
@ApiTags('handbooks')
@routeAccess('operator')
@Controller('handbooks')
export class HandbooksController {
  constructor(
    @Inject(RefreshHandbookUseCase) private readonly refreshHandbook: RefreshHandbookUseCase,
  ) {}

  @Post(':handbook/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue a read of a handbook',
    description:
      'A worker reads the handbook through the best proxies and the hub keeps it. The hub asks for it by itself when it was never read, and every week.',
  })
  @ApiAcceptedResponse({ standardSchema: jobAcceptedResponseSchema })
  refresh(
    @Param('handbook', { schema: handbookSchema }) handbook: HandbookType,
    @Req() request: Request,
  ): Promise<JobAcceptedResponseType> {
    // An administrator who asks follows the job; the operator with the key has no user.
    return this.refreshHandbook.execute(handbook, findIdentity(request)?.userId ?? null);
  }
}
