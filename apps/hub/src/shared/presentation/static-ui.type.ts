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

/**
 * The pages load nothing of other origins, but the pictures from `imageOrigins` (where the storage hands them
 * out, when that is not the host of the hub), and are shown on no other page.
 */
function uiHeaders(imageOrigins: string[]): Record<string, string> {
  const images = ["'self'", ...imageOrigins].join(' ');

  return {
    'Content-Security-Policy': `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src ${images} data:; frame-ancestors 'none'`,
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  };
}

/** What a page needs of an application: to mount handlers at a path. */
export interface HandlerMountInterface {
  use(path: string, handler: RequestHandler): unknown;
}

/** Serves a built app from `directory` at `path`: its files, and its page for the routes the app draws itself. */
export function serveStaticUi(
  app: HandlerMountInterface,
  path: string,
  directory: string,
  imageOrigins: string[] = [],
): void {
  const headers = uiHeaders(imageOrigins);
  app.use(path, (_request: Request, response: Response, next: NextFunction): void => {
    response.set(headers);
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
