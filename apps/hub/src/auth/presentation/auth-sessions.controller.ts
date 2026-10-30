import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Req } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import {
  ListAuthSessionsUseCase,
  RevokeAuthSessionUseCase,
  RevokeOtherAuthSessionsUseCase,
} from '../../auth-session/application/index.js';
import { requireIdentity } from '../../shared/presentation/request-identity.type.js';
import {
  authSessionIdParamSchema,
  authSessionsResponseSchema,
  type AuthSessionsResponseType,
  revokedResponseSchema,
  type RevokedResponseType,
} from './auth.type.js';

/** The logins of the user, one session each: the devices they are signed in on. */
@ApiTags('auth')
@Controller('auth/sessions')
export class AuthSessionsController {
  constructor(
    @Inject(ListAuthSessionsUseCase) private readonly listSessions: ListAuthSessionsUseCase,
    @Inject(RevokeAuthSessionUseCase) private readonly revokeSession: RevokeAuthSessionUseCase,
    @Inject(RevokeOtherAuthSessionsUseCase)
    private readonly revokeOthers: RevokeOtherAuthSessionsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The sessions of the user, the most recently used first' })
  @ApiOkResponse({ standardSchema: authSessionsResponseSchema })
  @ApiUnauthorizedResponse({ description: 'No live session' })
  async list(@Req() request: Request): Promise<AuthSessionsResponseType> {
    const { userId, sessionId } = requireIdentity(request);
    const sessions = await this.listSessions.execute(userId);

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        ip: session.ip,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        current: session.id === sessionId,
      })),
    };
  }

  @Delete()
  @ApiOperation({
    summary: 'End every session but this one',
    description: 'Signs the user out everywhere else, e.g. after a device was lost.',
  })
  @ApiOkResponse({ standardSchema: revokedResponseSchema })
  async revokeAllOthers(@Req() request: Request): Promise<RevokedResponseType> {
    const { userId, sessionId } = requireIdentity(request);

    return { revoked: await this.revokeOthers.execute(userId, sessionId) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End one session of the user' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "The session is unknown, ended already or not the user's" })
  async revoke(
    @Param('id', { schema: authSessionIdParamSchema }) id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.revokeSession.execute(requireIdentity(request).userId, id);
  }
}
