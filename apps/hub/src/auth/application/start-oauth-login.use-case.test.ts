import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import type { OauthProviderPort, OauthProvidersType } from './oauth-provider.port.js';
import { OauthProviderNotConfiguredError } from './oauth-provider-not-configured.error.js';
import { StartOauthLoginUseCase } from './start-oauth-login.use-case.js';

const provider: OauthProviderPort = {
  authorizationUrl: ({ state, codeChallenge, redirectUri }): string =>
    `https://provider.test/authorize?${new URLSearchParams([
      ['state', state],
      ['code_challenge', codeChallenge],
      ['redirect_uri', redirectUri],
    ]).toString()}`,
  fetchProfile: (): never => {
    throw new Error('not used');
  },
};
const providers: OauthProvidersType = new Map([['google', provider]]);
const redirectUri = 'http://localhost:3000/auth/oauth/google/callback';

void test('sends the user to the provider with a state and the PKCE challenge of a secret kept for the callback', (): void => {
  const useCase = new StartOauthLoginUseCase(providers);

  const { url, state, codeVerifier } = useCase.execute({ provider: 'google', redirectUri });

  const query = new URL(url).searchParams;
  assert.equal(query.get('state'), state);
  assert.equal(query.get('redirect_uri'), redirectUri);
  assert.equal(
    query.get('code_challenge'),
    createHash('sha256').update(codeVerifier).digest('base64url'),
  );
  assert.ok(codeVerifier.length >= 43);
});

void test('every login gets its own state and verifier', (): void => {
  const useCase = new StartOauthLoginUseCase(providers);

  const first = useCase.execute({ provider: 'google', redirectUri });
  const second = useCase.execute({ provider: 'google', redirectUri });

  assert.notEqual(first.state, second.state);
  assert.notEqual(first.codeVerifier, second.codeVerifier);
});

void test('knows no provider that is not set up', (): void => {
  const useCase = new StartOauthLoginUseCase(providers);

  assert.throws(
    () => useCase.execute({ provider: 'github', redirectUri }),
    OauthProviderNotConfiguredError,
  );
});
