import type { LogLevelType } from 'logger';

export const APP_CONFIG = Symbol('AppConfig');

export interface AppConfigInterface {
  databaseUrl: string;
  redisUrl: string;
  port: number;
  /** How many of the best proxies a price fetch job may try. */
  priceProxyCount: number;
  priceTimeoutMs: number;
  /** error, warn, info, debug or verbose. */
  logLevel: LogLevelType;
}
