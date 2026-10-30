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
  /** Logins of one email per window, whoever they come from. */
  authLoginMaxAttempts: number;
  /** Logins from one address per window, of any emails: wider, as an address may be shared. */
  authLoginMaxAttemptsPerIp: number;
  /** Sign-ups from one address per window. */
  authRegisterMaxAttempts: number;
  /** Where the hub is reached from outside: the providers send the user back here. */
  publicUrl: string;
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
