import { createHash, timingSafeEqual } from 'node:crypto';

import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { GetAccountUseCase } from '../../account/application/index.js';
import {
  type AuthIdentityInterface,
  ResolveAuthSessionUseCase,
} from '../../auth-session/application/index.js';
import { ApiKeyRequiredError } from '../../shared/application/api-key-required.error.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import { NotAdministratorError } from '../../shared/application/not-administrator.error.js';
import { NotSignedInError } from '../../shared/application/not-signed-in.error.js';
import { rememberIdentity } from '../../shared/presentation/request-identity.type.js';
import { routeAccess, type RouteAccessType } from '../../shared/presentation/route-access.type.js';
import { isAdministrator } from '../application/administrator.type.js';
import { SessionCookieParser } from './session-cookie.parser.js';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * Guards every route, as the route says: by the session cookie of a user or of an administrator, or by
 * the API key of the operator. The key and the cookie are not mixed: a request that brings a key is
 * judged by the key alone.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  /** Both sides are compared as digests: of equal length, whatever the key given. */
  private readonly operatorKeyDigest: Buffer | null;
  private readonly adminEmails: readonly string[];

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ResolveAuthSessionUseCase) private readonly resolveSession: ResolveAuthSessionUseCase,
    @Inject(SessionCookieParser) private readonly cookies: SessionCookieParser,
    @Inject(GetAccountUseCase) private readonly getAccount: GetAccountUseCase,
    @Inject(APP_CONFIG) config: AppConfigInterface,
  ) {
    this.adminEmails = config.adminEmails;
    this.operatorKeyDigest = config.operatorApiKey === null ? null : digest(config.operatorApiKey);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // A route without the decorator has no metadata, which the typing of the decorator leaves out.
    const access =
      this.reflector.getAllAndOverride<RouteAccessType | undefined>(routeAccess.KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'user';
    if (access === 'public') return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (access === 'operator') {
      if (request.headers.authorization === undefined) await this.requireAdmin(request);
      else this.requireOperatorKey(request);
    } else if (access === 'admin') {
      await this.requireAdmin(request);
    } else {
      await this.requireUser(request);
    }

    return true;
  }

  private requireOperatorKey(request: Request): void {
    const key = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1];
    if (
      key === undefined ||
      this.operatorKeyDigest === null ||
      !timingSafeEqual(digest(key), this.operatorKeyDigest)
    ) {
      throw new ApiKeyRequiredError();
    }
  }

  private async requireUser(request: Request): Promise<AuthIdentityInterface> {
    const token = this.cookies.parse(request.headers.cookie);
    const identity = token === null ? null : await this.resolveSession.execute(token);
    if (identity === null) throw new NotSignedInError();

    rememberIdentity(request, identity);

    return identity;
  }

  private async requireAdmin(request: Request): Promise<void> {
    const { userId } = await this.requireUser(request);
    const user = await this.getAccount.execute(userId);
    if (user === null || !isAdministrator(user, this.adminEmails))
      throw new NotAdministratorError();
  }
}
