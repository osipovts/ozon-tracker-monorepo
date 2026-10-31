import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { PasswordHasherPort } from '../../account/application/password-hasher.port.js';
import { RegisterAccountUseCase } from '../../account/application/register-account.use-case.js';
import { ResolveOauthAccountUseCase } from '../../account/application/resolve-oauth-account.use-case.js';
import { InMemoryAccountRegistrationAdapter } from '../../account/infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../../account/infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryLinkedIdentityRepositoryAdapter } from '../../account/infrastructure/in-memory-linked-identity-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../../account/infrastructure/in-memory-user-repository.adapter.js';
import { ResolveAuthSessionUseCase } from '../../auth-session/application/resolve-auth-session.use-case.js';
import { RevokeOtherAuthSessionsUseCase } from '../../auth-session/application/revoke-other-auth-sessions.use-case.js';
import { StartAuthSessionUseCase } from '../../auth-session/application/start-auth-session.use-case.js';
import { InMemoryAuthSessionRepositoryAdapter } from '../../auth-session/infrastructure/in-memory-auth-session-repository.adapter.js';
import { FakeOauthProviderAdapter } from '../infrastructure/fake-oauth-provider.adapter.js';
import { CompleteOauthLoginUseCase } from './complete-oauth-login.use-case.js';
import { OauthLoginFailedError } from './oauth-login-failed.error.js';
import type { OauthProvidersType } from './oauth-provider.port.js';
import { OauthProviderNotConfiguredError } from './oauth-provider-not-configured.error.js';
import { StartOauthLoginUseCase } from './start-oauth-login.use-case.js';

const redirectUri = 'http://localhost:3000/auth/oauth/google/callback';
const policy = { idleTtlMs: 60_000, absoluteTtlMs: 120_000 };

function setup(): {
  provider: FakeOauthProviderAdapter;
  register: RegisterAccountUseCase;
  startSession: StartAuthSessionUseCase;
  start: StartOauthLoginUseCase;
  complete: CompleteOauthLoginUseCase;
  resolve: ResolveAuthSessionUseCase;
} {
  const provider = new FakeOauthProviderAdapter();
  const providers: OauthProvidersType = new Map([['google', provider]]);
  const users = new InMemoryUserRepositoryAdapter();
  const identities = new InMemoryLinkedIdentityRepositoryAdapter();
  const sessions = new InMemoryAuthSessionRepositoryAdapter();
  const registration = new InMemoryAccountRegistrationAdapter(
    users,
    new InMemoryCredentialRepositoryAdapter(),
    identities,
  );

  return {
    provider,
    register: new RegisterAccountUseCase(registration, passwordHasher),
    startSession: new StartAuthSessionUseCase(sessions, policy),
    start: new StartOauthLoginUseCase(providers),
    complete: new CompleteOauthLoginUseCase(
      providers,
      new ResolveOauthAccountUseCase(users, identities, registration),
      new StartAuthSessionUseCase(sessions, policy),
      new RevokeOtherAuthSessionsUseCase(sessions),
    ),
    resolve: new ResolveAuthSessionUseCase(sessions, policy),
  };
}

const passwordHasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};

const client = { userAgent: 'Mozilla/5.0', ip: '203.0.113.7' };

void test('logs the user in with a session once the provider vouches for the code', async (): Promise<void> => {
  const { start, complete, resolve } = setup();
  const { state, codeVerifier } = start.execute({ provider: 'google', redirectUri });

  const result = await complete.execute({
    provider: 'google',
    code: 'good-code',
    state,
    expectedState: state,
    codeVerifier,
    redirectUri,
    ...client,
  });

  assert.equal(result.user.email, 'jane@example.com');
  assert.equal((await resolve.execute(result.token))?.userId, result.user.id);
});

void test('refuses a callback of another browser: the state of the cookie is not the one that came back', async (): Promise<void> => {
  const { provider, start, complete } = setup();
  const { state, codeVerifier } = start.execute({ provider: 'google', redirectUri });

  await assert.rejects(
    complete.execute({
      provider: 'google',
      code: 'good-code',
      state: 'forged-state',
      expectedState: state,
      codeVerifier,
      redirectUri,
      ...client,
    }),
    OauthLoginFailedError,
  );
  assert.equal(provider.exchanges, 0);
});

void test('refuses a code the provider does not accept, and a provider that is not set up', async (): Promise<void> => {
  const { start, complete } = setup();
  const { state, codeVerifier } = start.execute({ provider: 'google', redirectUri });
  const input = {
    code: 'bad-code',
    state,
    expectedState: state,
    codeVerifier,
    redirectUri,
    ...client,
  };

  await assert.rejects(complete.execute({ provider: 'google', ...input }), OauthLoginFailedError);
  await assert.rejects(
    complete.execute({ provider: 'github', ...input }),
    OauthProviderNotConfiguredError,
  );
});

void test('ends the sessions of an account the provider has taken over, and starts a new one for the owner', async (): Promise<void> => {
  const { register, startSession, start, complete, resolve } = setup();
  const squatter = await register.execute({ email: 'jane@example.com', password: 'squatter-pass' });
  const squatterSession = await startSession.execute({
    userId: squatter.id,
    userAgent: 'Squatter',
    ip: '198.51.100.9',
  });
  const { state, codeVerifier } = start.execute({ provider: 'google', redirectUri });

  const owner = await complete.execute({
    provider: 'google',
    code: 'good-code',
    state,
    expectedState: state,
    codeVerifier,
    redirectUri,
    ...client,
  });

  assert.equal(owner.user.id, squatter.id);
  assert.equal(await resolve.execute(squatterSession.token), null);
  assert.equal((await resolve.execute(owner.token))?.userId, squatter.id);
});

void test('leaves the sessions of an account alone when nothing was taken over', async (): Promise<void> => {
  const { startSession, start, complete, resolve } = setup();
  const first = start.execute({ provider: 'google', redirectUri });
  const input = { provider: 'google', code: 'good-code', redirectUri, ...client } as const;
  const earlier = await complete.execute({
    ...input,
    state: first.state,
    expectedState: first.state,
    codeVerifier: first.codeVerifier,
  });
  const other = await startSession.execute({
    userId: earlier.user.id,
    userAgent: 'Phone',
    ip: null,
  });
  const second = start.execute({ provider: 'google', redirectUri });

  await complete.execute({
    ...input,
    state: second.state,
    expectedState: second.state,
    codeVerifier: second.codeVerifier,
  });

  assert.notEqual(await resolve.execute(other.token), null);
  assert.notEqual(await resolve.execute(earlier.token), null);
});
