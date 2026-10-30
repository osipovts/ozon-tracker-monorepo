import { parseLogLevel } from 'logger';
import { z } from 'zod';

import type { AppConfigInterface } from '../application/app-config.interface.js';

/** Both the id and the secret of the OAuth app, or neither: half of them is a mistake to report. */
const oauthClientSchema = z
  .object({ clientId: z.string().min(1), clientSecret: z.string().min(1) })
  .nullable();

function oauthClient(
  env: NodeJS.ProcessEnv,
  idName: string,
  secretName: string,
): { clientId?: string; clientSecret?: string } | null {
  const clientId = env[idName];
  const clientSecret = env[secretName];
  if ((clientId ?? '') === '' && (clientSecret ?? '') === '') return null;

  return {
    ...(clientId === undefined ? {} : { clientId }),
    ...(clientSecret === undefined ? {} : { clientSecret }),
  };
}

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
  authRateLimitWindowMs: z.coerce
    .number()
    .int()
    .min(1000)
    .default(15 * 60_000),
  authLoginMaxAttempts: z.coerce.number().int().min(1).default(10),
  authLoginMaxAttemptsPerIp: z.coerce.number().int().min(1).default(50),
  authRegisterMaxAttempts: z.coerce.number().int().min(1).default(5),
  publicUrl: z
    .url({ protocol: /^https?$/ })
    .default('http://localhost:3000')
    .transform((value): string => value.replace(/\/+$/, '')),
  // A path of the hub: a full URL would let a login be sent anywhere.
  authSuccessRedirect: z
    .string()
    .regex(/^\/(?!\/)/)
    .default('/auth/me'),
  googleOauth: oauthClientSchema,
  githubOauth: oauthClientSchema,
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
        authRateLimitWindowMs: env['AUTH_RATE_LIMIT_WINDOW_MS'],
        authLoginMaxAttempts: env['AUTH_LOGIN_MAX_ATTEMPTS'],
        authLoginMaxAttemptsPerIp: env['AUTH_LOGIN_MAX_ATTEMPTS_PER_IP'],
        authRegisterMaxAttempts: env['AUTH_REGISTER_MAX_ATTEMPTS'],
        publicUrl: env['PUBLIC_URL'],
        authSuccessRedirect: env['AUTH_SUCCESS_REDIRECT'],
        googleOauth: oauthClient(env, 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
        githubOauth: oauthClient(env, 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'),
        operatorApiKey: env['HUB_API_KEY'] === '' ? null : (env['HUB_API_KEY'] ?? null),
      }),
      logLevel: parseLogLevel(env['LOG_LEVEL'], 'verbose'),
    };
  }
}
