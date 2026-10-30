import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { type INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { AuthenticateWithPasswordUseCase } from '../../account/application/authenticate-with-password.use-case.js';
import { GetAccountUseCase } from '../../account/application/get-account.use-case.js';
import { RegisterAccountUseCase } from '../../account/application/register-account.use-case.js';
import { Argon2idPasswordHasherAdapter } from '../../account/infrastructure/argon2id-password-hasher.adapter.js';
import { InMemoryAccountRegistrationAdapter } from '../../account/infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../../account/infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../../account/infrastructure/in-memory-user-repository.adapter.js';
import { EndAuthSessionUseCase } from '../../auth-session/application/end-auth-session.use-case.js';
import { ResolveAuthSessionUseCase } from '../../auth-session/application/resolve-auth-session.use-case.js';
import { StartAuthSessionUseCase } from '../../auth-session/application/start-auth-session.use-case.js';
import { InMemoryAuthSessionRepositoryAdapter } from '../../auth-session/infrastructure/in-memory-auth-session-repository.adapter.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import { ApplicationErrorFilter } from '../../shared/presentation/application-error.filter.js';
import { LogInUseCase } from '../application/log-in.use-case.js';
import { SignUpUseCase } from '../application/sign-up.use-case.js';
import { AccessGuard } from './access.guard.js';
import { AuthController } from './auth.controller.js';
import { authResponseSchema } from './auth.type.js';
import { SessionCookieParser } from './session-cookie.parser.js';

const config: AppConfigInterface = {
  databaseUrl: 'postgresql://localhost:5432/hub',
  redisUrl: 'redis://localhost:6379',
  port: 3000,
  priceProxyCount: 5,
  priceTimeoutMs: 60000,
  authSessionIdleTtlMs: 60_000,
  authSessionAbsoluteTtlMs: 120_000,
  authRateLimitWindowMs: 60_000,
  authLoginMaxAttempts: 1000,
  authLoginMaxAttemptsPerIp: 1000,
  authRegisterMaxAttempts: 1000,
  publicUrl: 'http://localhost:3000',
  authSuccessRedirect: '/auth/me',
  googleOauth: null,
  githubOauth: null,
  operatorApiKey: null,
  authCookieSecure: true,
  logLevel: 'error',
};

let app: INestApplication;
let baseUrl: string;

/** The hub with the given limits of the logins and the sign-ups of one address. */
async function createApp(attempts: number): Promise<INestApplication> {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const policy = { idleTtlMs: 60_000, absoluteTtlMs: 120_000 };
  // The cheapest cost argon2 allows: the tests are about the flow, not the hardness.
  const hasher = new Argon2idPasswordHasherAdapter({ memoryKib: 64, passes: 1, parallelism: 1 });
  const startSession = new StartAuthSessionUseCase(sessions, policy);
  const limiter = new InMemoryRateLimiterAdapter();
  const register = new RegisterAccountUseCase(
    new InMemoryAccountRegistrationAdapter(users, credentials),
    hasher,
  );

  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
      { provide: APP_FILTER, useClass: ApplicationErrorFilter },
      { provide: APP_CONFIG, useValue: config },
      {
        provide: SignUpUseCase,
        useValue: new SignUpUseCase(register, startSession, limiter, {
          limit: attempts,
          windowMs: 60_000,
        }),
      },
      {
        provide: LogInUseCase,
        useValue: new LogInUseCase(
          new AuthenticateWithPasswordUseCase(users, credentials, hasher),
          startSession,
          limiter,
          {
            perEmail: { limit: attempts, windowMs: 60_000 },
            perIp: { limit: attempts, windowMs: 60_000 },
          },
        ),
      },
      { provide: EndAuthSessionUseCase, useValue: new EndAuthSessionUseCase(sessions) },
      {
        provide: ResolveAuthSessionUseCase,
        useValue: new ResolveAuthSessionUseCase(sessions, policy),
      },
      { provide: GetAccountUseCase, useValue: new GetAccountUseCase(users) },
      SessionCookieParser,
      { provide: APP_GUARD, useClass: AccessGuard },
    ],
  }).compile();

  const created = moduleRef.createNestApplication();
  await created.listen(0);

  return created;
}

before(async (): Promise<void> => {
  app = await createApp(1000);
  baseUrl = await app.getUrl();
});

after(async (): Promise<void> => {
  await app.close();
});

interface ReplyInterface {
  status: number;
  body: unknown;
  setCookie: string[];
}

async function call(path: string, init: RequestInit = {}): Promise<ReplyInterface> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  const body: unknown = text === '' ? null : JSON.parse(text);

  return { status: response.status, body, setCookie: response.headers.getSetCookie() };
}

function post(path: string, body: unknown, cookie?: string): Promise<ReplyInterface> {
  return call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie === undefined ? {} : { cookie }) },
    body: JSON.stringify(body),
  });
}

function me(cookie?: string): Promise<ReplyInterface> {
  return call('/auth/me', cookie === undefined ? {} : { headers: { cookie } });
}

/** The `name=value` pair of the cookie a reply sets, to send it back. */
function cookieOf(reply: ReplyInterface): string {
  const pair = reply.setCookie[0]?.split(';')[0];
  assert.ok(pair !== undefined);

  return pair;
}

const jane = { email: 'Jane@Example.com', password: 'secret-pass' };
const notSignedIn = { statusCode: 401, message: 'Sign in first' };
const wrongLogin = { statusCode: 401, message: 'The email or the password is wrong' };

void test('registers a user and starts their session in a hardened cookie', async (): Promise<void> => {
  const reply = await post('/auth/register', jane);

  assert.equal(reply.status, 201);
  const { user } = authResponseSchema.parse(reply.body);
  assert.equal(user.email, 'jane@example.com');

  assert.equal(reply.setCookie.length, 1);
  const attributes = reply.setCookie[0]?.split('; ') ?? [];
  assert.match(attributes[0] ?? '', /^session=[A-Za-z0-9_-]{43}$/);
  assert.ok(attributes.includes('HttpOnly'));
  assert.ok(attributes.includes('Secure'));
  assert.ok(attributes.includes('SameSite=Lax'));
  assert.ok(attributes.includes('Path=/'));
  assert.ok(attributes.some((attribute): boolean => attribute.startsWith('Expires=')));
});

void test('refuses a registered email, a bad email and a short password', async (): Promise<void> => {
  const twin = await post('/auth/register', { ...jane, email: 'JANE@example.com' });
  assert.equal(twin.status, 409);
  assert.equal(twin.setCookie.length, 0);

  assert.equal((await post('/auth/register', { ...jane, email: 'nope' })).status, 400);
  assert.equal((await post('/auth/register', { ...jane, password: 'short' })).status, 400);
});

void test('answers who the session cookie belongs to, and 401 without a live one', async (): Promise<void> => {
  const registered = await post('/auth/register', {
    email: 'sam@example.com',
    password: 'secret-pass',
  });
  const { user } = authResponseSchema.parse(registered.body);

  const own = await me(cookieOf(registered));
  assert.equal(own.status, 200);
  assert.deepEqual(authResponseSchema.parse(own.body).user, user);

  const anonymous = await me();
  assert.equal(anonymous.status, 401);
  assert.deepEqual(anonymous.body, notSignedIn);

  const forged = await me('session=not-a-session');
  assert.equal(forged.status, 401);
  assert.deepEqual(forged.body, notSignedIn);
});

void test('logs in with the password into a new session; a wrong login tells nothing about why', async (): Promise<void> => {
  await post('/auth/register', { email: 'ann@example.com', password: 'secret-pass' });

  const first = await post('/auth/login', { email: 'ANN@example.com', password: 'secret-pass' });
  const second = await post('/auth/login', { email: 'ann@example.com', password: 'secret-pass' });
  assert.equal(first.status, 200);
  assert.equal(authResponseSchema.parse(first.body).user.email, 'ann@example.com');
  assert.notEqual(cookieOf(first), cookieOf(second));
  assert.equal((await me(cookieOf(first))).status, 200);
  assert.equal((await me(cookieOf(second))).status, 200);

  const wrongPassword = await post('/auth/login', {
    email: 'ann@example.com',
    password: 'wrong-pass',
  });
  const unknownEmail = await post('/auth/login', {
    email: 'nobody@example.com',
    password: 'secret-pass',
  });
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(wrongPassword.body, wrongLogin);
  assert.deepEqual(unknownEmail.body, wrongLogin);
  assert.equal(wrongPassword.setCookie.length, 0);
});

void test('logs out: the session is gone and the cookie is cleared; logging out twice is harmless', async (): Promise<void> => {
  const registered = await post('/auth/register', {
    email: 'bob@example.com',
    password: 'secret-pass',
  });
  const cookie = cookieOf(registered);

  const first = await post('/auth/logout', {}, cookie);
  assert.equal(first.status, 204);
  assert.match(first.setCookie[0] ?? '', /^session=;/);
  assert.match(first.setCookie[0] ?? '', /Expires=Thu, 01 Jan 1970/);

  assert.equal((await me(cookie)).status, 401);
  assert.equal((await post('/auth/logout', {}, cookie)).status, 204);
  assert.equal((await post('/auth/logout', {})).status, 204);
});

void test('answers 429 with the time to wait once an address tries too often', async (): Promise<void> => {
  const limited = await createApp(2);
  try {
    const url = `${await limited.getUrl()}/auth/login`;
    const login = (): Promise<Response> =>
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'nobody@example.com', password: 'secret-pass' }),
      });

    assert.equal((await login()).status, 401);
    assert.equal((await login()).status, 401);

    const refused = await login();
    assert.equal(refused.status, 429);
    assert.match(refused.headers.get('retry-after') ?? '', /^[1-9]\d*$/);
    assert.deepEqual(await refused.json(), {
      statusCode: 429,
      message: 'Too many attempts: try again later',
    });
  } finally {
    await limited.close();
  }
});
