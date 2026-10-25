import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { sessionExportFileSchema, type SessionExportFileType } from 'queue-contract';

import { DeleteSessionUseCase } from '../../application/session/delete-session.use-case.js';
import { ImportSessionUseCase } from '../../application/session/import-session.use-case.js';
import { ListSessionsUseCase } from '../../application/session/list-sessions.use-case.js';
import type { BrowserSessionEntity } from '../../domain/session/browser-session.entity.js';
import {
  paginationQuerySchema,
  type PaginationQueryType,
} from '../shared/pagination-query.type.js';
import {
  sessionIdParamSchema,
  sessionListResponseSchema,
  type SessionListResponseType,
  sessionSchema,
  type SessionType,
} from './session.type.js';

function toSession(session: BrowserSessionEntity): SessionType {
  const { snapshot } = session;

  return {
    id: snapshot.id,
    marketplace: snapshot.marketplace,
    proxy: snapshot.proxyServer,
    exitIp: snapshot.exitIp,
    userAgent: snapshot.userAgent,
    status: snapshot.status,
    staleReason: snapshot.staleReason,
    cookies: snapshot.storageState.cookies.length,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
    lastUsedAt: snapshot.lastUsedAt?.toISOString() ?? null,
  };
}

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    @Inject(ImportSessionUseCase) private readonly importSession: ImportSessionUseCase,
    @Inject(ListSessionsUseCase) private readonly listSessions: ListSessionsUseCase,
    @Inject(DeleteSessionUseCase) private readonly deleteSession: DeleteSessionUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Import a browser session',
    description:
      'Sent by `pnpm sessions:onboard` with a session captured in a browser window. ' +
      'It replaces the session of the same marketplace and proxy and is given to the workers ' +
      'together with that proxy.',
  })
  @ApiCreatedResponse({ standardSchema: sessionSchema })
  async import(
    @Body({ schema: sessionExportFileSchema }) body: SessionExportFileType,
  ): Promise<SessionType> {
    return toSession(
      await this.importSession.execute({
        id: body.session.id,
        marketplace: body.marketplace,
        proxyServer: body.proxy,
        exitIp: body.session.exitIp,
        userAgent: body.session.userAgent,
        storageState: body.session.storageState,
        createdAt: new Date(body.createdAt),
      }),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List sessions without their cookies, the newest first' })
  @ApiOkResponse({ standardSchema: sessionListResponseSchema })
  async list(
    @Query({ schema: paginationQuerySchema }) query: PaginationQueryType,
  ): Promise<SessionListResponseType> {
    const page = await this.listSessions.execute({ page: query.page, pageSize: query.pageSize });

    return {
      items: page.items.map(toSession),
      page: query.page,
      pageSize: query.pageSize,
      total: page.total,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a session' })
  @ApiNoContentResponse({ description: 'The session is deleted' })
  @ApiNotFoundResponse({ description: 'The session does not exist' })
  async remove(@Param('id', { schema: sessionIdParamSchema }) id: string): Promise<void> {
    await this.deleteSession.execute(id);
  }
}
