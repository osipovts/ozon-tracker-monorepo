import { parseLogLevel } from 'logger';
import { z } from 'zod';

import type { AppConfigInterface } from '../application/app-config.interface.js';

const configSchema = z.object({
  databaseUrl: z.string().min(1),
  redisUrl: z.string().min(1).default('redis://localhost:6379'),
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  priceProxyCount: z.coerce.number().int().min(1).max(20).default(5),
  priceTimeoutMs: z.coerce.number().int().min(1000).max(60000).default(60000),
  authSessionIdleTtlMs: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(14 * 24 * 3_600_000),
  authSessionAbsoluteTtlMs: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(30 * 24 * 3_600_000),
  operatorApiKey: z.string().min(16).nullable(),
  authCookieSecure: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value): boolean => value === 'true'),
});

export class AppConfigParser {
  parse(env: NodeJS.ProcessEnv): AppConfigInterface {
    return {
      ...configSchema.parse({
        databaseUrl: env['DATABASE_URL'],
        redisUrl: env['REDIS_URL'],
        port: env['PORT'],
        priceProxyCount: env['PRICE_PROXY_COUNT'],
        priceTimeoutMs: env['PRICE_TIMEOUT_MS'],
        authSessionIdleTtlMs: env['AUTH_SESSION_IDLE_TTL_MS'],
        authSessionAbsoluteTtlMs: env['AUTH_SESSION_ABSOLUTE_TTL_MS'],
        authCookieSecure: env['AUTH_COOKIE_SECURE'],
        operatorApiKey: env['HUB_API_KEY'] === '' ? null : (env['HUB_API_KEY'] ?? null),
      }),
      logLevel: parseLogLevel(env['LOG_LEVEL'], 'verbose'),
    };
  }
}
