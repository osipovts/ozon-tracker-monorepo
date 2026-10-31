import { Injectable } from '@nestjs/common';
import { parseCookie } from 'cookie';

export const sessionCookieName = 'session';

@Injectable()
export class SessionCookieParser {
  /** The session token of a `Cookie` header, or null without one. */
  parse(header: string | undefined): string | null {
    if (header === undefined) return null;

    const token = parseCookie(header)[sessionCookieName];

    return token === undefined || token === '' ? null : token;
  }
}
