import { join } from 'node:path';

import {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  static as serveStatic,
} from 'express';

/** Where the admin panel is served from; the API keeps the rest of the paths. */
export const adminUiPath = '/panel';

/** The panel loads nothing of other origins and is shown on no other page. */
const panelHeaders: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

/** What the panel needs of an application: to mount handlers at a path. */
export interface HandlerMountInterface {
  use(path: string, handler: RequestHandler): unknown;
}

/** Serves the built panel from `directory`: its files, and its page for the routes the panel draws itself. */
export function serveAdminUi(app: HandlerMountInterface, directory: string): void {
  app.use(adminUiPath, (_request: Request, response: Response, next: NextFunction): void => {
    response.set(panelHeaders);
    next();
  });
  app.use(adminUiPath, serveStatic(directory));
  app.use(adminUiPath, (request: Request, response: Response, next: NextFunction): void => {
    if (request.method !== 'GET') {
      next();

      return;
    }
    response.sendFile(join(directory, 'index.html'));
  });
}
