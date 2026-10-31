import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import { ForeignOriginError } from '../../shared/application/foreign-origin.error.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

/** What a browser says of a request it sends without an Origin: only these two are from the hub or the user. */
const ownFetchSites = new Set(['same-origin', 'none']);

/**
 * A browser tells where a write comes from. The session cookie is `SameSite=Lax` already, which keeps
 * it from cross-site writes; this is the second wall, for what is same-site but not the hub itself (a
 * sibling subdomain). A client that is no browser sends neither header, and has no cookie to ride on.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(@Inject(APP_CONFIG) config: AppConfigInterface) {
    this.allowedOrigins = new Set([new URL(config.publicUrl).origin, ...config.authAllowedOrigins]);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (safeMethods.has(request.method)) return true;

    const origin = request.headers.origin;
    if (origin !== undefined) {
      if (this.allowedOrigins.has(origin)) return true;

      throw new ForeignOriginError();
    }

    const fetchSite = request.headers['sec-fetch-site'];
    if (fetchSite === undefined || ownFetchSites.has(fetchSite)) return true;

    throw new ForeignOriginError();
  }
}
