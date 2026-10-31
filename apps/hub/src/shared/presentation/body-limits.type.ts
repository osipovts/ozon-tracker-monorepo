import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

/** What a request of the API may carry: the logins and the products are a few hundred bytes. */
const defaultLimit = '100kb';

/**
 * The limit of the body of a request, which is read before any guard asks who sent it.
 * The application must be created with `bodyParser: false`.
 */
export function applyBodyLimits(app: NestExpressApplication): void {
  app.use(json({ limit: defaultLimit }));
}
