import type { LogLevelType } from 'logger';

export const APP_CONFIG = Symbol('AppConfig');

export interface OauthClientConfigInterface {
  clientId: string;
  clientSecret: string;
}

export interface AppConfigInterface {
  databaseUrl: string;
  redisUrl: string;
  port: number;
  /** How many of the best proxies a price fetch job may try. */
  priceProxyCount: number;
  priceTimeoutMs: number;
  /** A session that is not used for this long ends. */
  authSessionIdleTtlMs: number;
  /** A session ends this long after the login however active it is. */
  authSessionAbsoluteTtlMs: number;
  /** Whether the session cookie goes over HTTPS only. */
  authCookieSecure: boolean;
  /** The window the attempts of logging in and signing up are counted in. */
  authRateLimitWindowMs: number;
  /** Logins of one email from one address per window; also the password changes of a user. */
  authLoginMaxAttempts: number;
  /** Logins of one email per window from all the addresses together: generous, against a lockout. */
  authLoginMaxAttemptsPerEmail: number;
  /** Logins from one address per window, of any emails: wider, as an address may be shared. */
  authLoginMaxAttemptsPerIp: number;
  /** Sign-ups from one address per window. */
  authRegisterMaxAttempts: number;
  /**
   * How many reverse proxies stand in front of the hub: 0 when clients reach it directly. Behind
   * one, the address of a client is read from X-Forwarded-For, which only a hop count can trust.
   */
  trustProxy: number;
  /** Where the hub is reached from outside: the providers send the user back here. */
  publicUrl: string;
  /** Origins besides the hub itself that may write to it, e.g. a frontend of another origin. */
  authAllowedOrigins: string[];
  /** Where the user lands after a login through a provider: a path of the hub. */
  authSuccessRedirect: string;
  /** The OAuth app of Google; the login through it is off without one. */
  googleOauth: OauthClientConfigInterface | null;
  githubOauth: OauthClientConfigInterface | null;
  /** The key of the operator routes; without one they stay closed. */
  operatorApiKey: string | null;
  /** error, warn, info, debug or verbose. */
  logLevel: LogLevelType;
}
