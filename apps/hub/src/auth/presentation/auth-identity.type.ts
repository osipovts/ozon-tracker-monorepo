import type { Request } from 'express';

import type { AuthIdentityInterface } from '../../auth-session/application/index.js';

const identities = new WeakMap<Request, AuthIdentityInterface>();

/** The guard tells who a request is from, and the handlers ask; the request itself stays untouched. */
export function rememberIdentity(request: Request, identity: AuthIdentityInterface): void {
  identities.set(request, identity);
}

export function identityOf(request: Request): AuthIdentityInterface | null {
  return identities.get(request) ?? null;
}
