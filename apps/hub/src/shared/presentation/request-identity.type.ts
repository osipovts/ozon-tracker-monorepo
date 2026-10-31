import type { Request } from 'express';

import { NotSignedInError } from '../application/not-signed-in.error.js';

export interface RequestIdentityInterface {
  userId: string;
  sessionId: string;
}

const identities = new WeakMap<Request, RequestIdentityInterface>();

/** The guard tells who a request is from, and the handlers ask; the request itself stays untouched. */
export function rememberIdentity(request: Request, identity: RequestIdentityInterface): void {
  identities.set(request, identity);
}

/** The signed-in user of a request that passed the guard of a `user` route. */
export function requireIdentity(request: Request): RequestIdentityInterface {
  const identity = identities.get(request);
  if (identity === undefined) throw new NotSignedInError();

  return identity;
}

/** Whoever the guard let in with a session, or null for a request that came with the key of the operator. */
export function findIdentity(request: Request): RequestIdentityInterface | null {
  return identities.get(request) ?? null;
}
