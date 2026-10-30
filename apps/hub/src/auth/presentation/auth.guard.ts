import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { ResolveAuthSessionUseCase } from '../../auth-session/application/index.js';
import { NotSignedInError } from '../application/not-signed-in.error.js';
import { rememberIdentity } from './auth-identity.type.js';
import { SessionCookieParser } from './session-cookie.parser.js';

/** Lets in the requests that carry the cookie of a live session. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(ResolveAuthSessionUseCase) private readonly resolveSession: ResolveAuthSessionUseCase,
    @Inject(SessionCookieParser) private readonly cookies: SessionCookieParser,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.cookies.parse(request.headers.cookie);
    const identity = token === null ? null : await this.resolveSession.execute(token);
    if (identity === null) throw new NotSignedInError();

    rememberIdentity(request, identity);

    return true;
  }
}
