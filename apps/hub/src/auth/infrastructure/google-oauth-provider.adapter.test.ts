import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { OauthLoginFailedError } from '../application/oauth-login-failed.error.js';
import { FakeHttpServerAdapter } from './fake-http-server.adapter.js';
import { GoogleOauthProviderAdapter } from './google-oauth-provider.adapter.js';

const server = new FakeHttpServerAdapter();
let google: GoogleOauthProviderAdapter;

before(async (): Promise<void> => {
  const base = await server.start();
  google = new GoogleOauthProviderAdapter(
    { clientId: 'client-1', clientSecret: 'secret-1' },
    {
      authorizeUrl: `${base}/authorize`,
      tokenUrl: `${base}/token`,
      userinfoUrl: `${base}/userinfo`,
    },
  );
  server.reply('POST', '/token', { status: 200, body: { access_token: 'token-1' } });
});

after(async (): Promise<void> => {
  await server.stop();
});

const exchange = { code: 'code-1', codeVerifier: 'verifier-1', redirectUri: 'http://hub/callback' };

void test('sends the user to Google for their email, with the state and the PKCE challenge', (): void => {
  const url = new URL(
    google.authorizationUrl({
      state: 'state-1',
      codeChallenge: 'challenge-1',
      redirectUri: 'http://hub/callback',
    }),
  );

  assert.equal(url.pathname, '/authorize');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    client_id: 'client-1',
    redirect_uri: 'http://hub/callback',
    response_type: 'code',
    scope: 'openid email',
    state: 'state-1',
    code_challenge: 'challenge-1',
    code_challenge_method: 'S256',
  });
});

void test('reads the profile with the access token: the stable subject, the email and whether it is verified', async (): Promise<void> => {
  server.reply('GET', '/userinfo', {
    status: 200,
    body: { sub: '1001', email: 'jane@example.com', email_verified: true },
  });

  assert.deepEqual(await google.fetchProfile(exchange), {
    subject: '1001',
    email: 'jane@example.com',
    emailVerified: true,
  });
  assert.equal(server.requests.at(-1)?.headers.authorization, 'Bearer token-1');
});

void test('does not vouch for an email Google did not verify or did not give', async (): Promise<void> => {
  server.reply('GET', '/userinfo', {
    status: 200,
    body: { sub: '1001', email: 'jane@example.com', email_verified: false },
  });
  assert.equal((await google.fetchProfile(exchange)).emailVerified, false);

  server.reply('GET', '/userinfo', { status: 200, body: { sub: '1001' } });
  assert.deepEqual(await google.fetchProfile(exchange), {
    subject: '1001',
    email: null,
    emailVerified: false,
  });

  server.reply('GET', '/userinfo', {
    status: 200,
    body: { sub: '1001', email: 'jane@example.com', email_verified: 'true' },
  });
  assert.equal((await google.fetchProfile(exchange)).emailVerified, true);
});

void test('refuses a profile it cannot read', async (): Promise<void> => {
  server.reply('GET', '/userinfo', { status: 401, body: { error: 'invalid_token' } });
  await assert.rejects(google.fetchProfile(exchange), OauthLoginFailedError);

  server.reply('GET', '/userinfo', { status: 200, body: { email: 'jane@example.com' } });
  await assert.rejects(google.fetchProfile(exchange), OauthLoginFailedError);
});
