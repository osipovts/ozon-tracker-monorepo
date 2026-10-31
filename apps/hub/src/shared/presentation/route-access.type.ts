import { Reflector } from '@nestjs/core';

/**
 * Who may call a route: anyone (`public`), a signed-in user (`user`, the default), an administrator
 * signed in (`admin`), or the operator of the hub: whoever holds its API key, or an administrator
 * signed in (`operator`). A user is not an operator.
 */
export type RouteAccessType = 'public' | 'user' | 'admin' | 'operator';

export const routeAccess = Reflector.createDecorator<RouteAccessType>();
