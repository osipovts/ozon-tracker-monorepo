import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

/** What a request of the API may carry: the logins and the products are a few hundred bytes. */
const defaultLimit = '100kb';

/** A session file carries the cookies and the local storage of a browser. */
const sessionImportLimit = '10mb';

/**
 * The limits of the body of a request, which is read before any guard asks who sent it: a wide one
 * only where it is needed. The first parser to read a body keeps it, so the wide one goes first.
 * The application must be created with `bodyParser: false`.
 */
export function applyBodyLimits(app: NestExpressApplication): void {
  app.use('/sessions', json({ limit: sessionImportLimit }));
  app.use(json({ limit: defaultLimit }));
}
