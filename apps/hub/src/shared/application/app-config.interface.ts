import type { LogLevelType } from 'logger';

export const APP_CONFIG = Symbol('AppConfig');

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
  /** The key of the operator routes; without one they stay closed. */
  operatorApiKey: string | null;
  /** error, warn, info, debug or verbose. */
  logLevel: LogLevelType;
}
