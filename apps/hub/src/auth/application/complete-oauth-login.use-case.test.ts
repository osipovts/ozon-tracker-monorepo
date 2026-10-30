import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ResolveOauthAccountUseCase } from '../../account/application/resolve-oauth-account.use-case.js';
import { InMemoryAccountRegistrationAdapter } from '../../account/infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../../account/infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryLinkedIdentityRepositoryAdapter } from '../../account/infrastructure/in-memory-linked-identity-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../../account/infrastructure/in-memory-user-repository.adapter.js';
import { ResolveAuthSessionUseCase } from '../../auth-session/application/resolve-auth-session.use-case.js';
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
    start: new StartOauthLoginUseCase(providers),
    complete: new CompleteOauthLoginUseCase(
      providers,
      new ResolveOauthAccountUseCase(users, identities, registration),
      new StartAuthSessionUseCase(sessions, policy),
    ),
    resolve: new ResolveAuthSessionUseCase(sessions, policy),
  };
}

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
