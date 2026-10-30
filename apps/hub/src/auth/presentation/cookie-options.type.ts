import type { CookieOptions } from 'express';

import type { AppConfigInterface } from '../../shared/application/app-config.interface.js';

/** The token is out of the reach of scripts, and a foreign site cannot make the browser send it. */
export function cookieOptionsOf(config: AppConfigInterface): CookieOptions {
  return { httpOnly: true, secure: config.authCookieSecure, sameSite: 'lax', path: '/' };
}
