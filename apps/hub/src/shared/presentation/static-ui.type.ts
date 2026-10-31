import { join } from 'node:path';

import {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  static as serveStatic,
} from 'express';

/** Where the admin panel and the client app are served from; the API keeps the rest of the paths. */
export const adminUiPath = '/panel';
export const clientUiPath = '/app';

/** The pages load nothing of other origins and are shown on no other page. */
const uiHeaders: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

/** What a page needs of an application: to mount handlers at a path. */
export interface HandlerMountInterface {
  use(path: string, handler: RequestHandler): unknown;
}

/** Serves a built app from `directory` at `path`: its files, and its page for the routes the app draws itself. */
export function serveStaticUi(app: HandlerMountInterface, path: string, directory: string): void {
  app.use(path, (_request: Request, response: Response, next: NextFunction): void => {
    response.set(uiHeaders);
    next();
  });
  app.use(path, serveStatic(directory));
  app.use(path, (request: Request, response: Response, next: NextFunction): void => {
    if (request.method !== 'GET') {
      next();

      return;
    }
    response.sendFile(join(directory, 'index.html'));
  });
}
