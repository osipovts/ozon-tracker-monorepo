import { Reflector } from '@nestjs/core';

/**
 * Who may call a route: anyone (`public`), a signed-in user (`user`, the default) or the operator
 * of the hub holding its API key (`operator`). A user is not an operator.
 */
export type RouteAccessType = 'public' | 'user' | 'operator';

export const routeAccess = Reflector.createDecorator<RouteAccessType>();
