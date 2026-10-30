import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { OauthLoginFailedError } from '../application/oauth-login-failed.error.js';
import { FakeHttpServerAdapter } from './fake-http-server.adapter.js';
import { GithubOauthProviderAdapter } from './github-oauth-provider.adapter.js';

const server = new FakeHttpServerAdapter();
let github: GithubOauthProviderAdapter;

before(async (): Promise<void> => {
  const base = await server.start();
  github = new GithubOauthProviderAdapter(
    { clientId: 'client-1', clientSecret: 'secret-1' },
    {
      authorizeUrl: `${base}/authorize`,
      tokenUrl: `${base}/token`,
      userUrl: `${base}/user`,
      emailsUrl: `${base}/user/emails`,
    },
  );
  server.reply('POST', '/token', { status: 200, body: { access_token: 'token-1' } });
  server.reply('GET', '/user', { status: 200, body: { id: 42, login: 'jane' } });
});

after(async (): Promise<void> => {
  await server.stop();
});

const exchange = { code: 'code-1', codeVerifier: 'verifier-1', redirectUri: 'http://hub/callback' };

void test('sends the user to GitHub for their emails, with the state and the PKCE challenge', (): void => {
  const url = new URL(
    github.authorizationUrl({
      state: 'state-1',
      codeChallenge: 'challenge-1',
      redirectUri: 'http://hub/callback',
    }),
  );

  assert.equal(url.pathname, '/authorize');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    client_id: 'client-1',
    redirect_uri: 'http://hub/callback',
    scope: 'read:user user:email',
    state: 'state-1',
    code_challenge: 'challenge-1',
    code_challenge_method: 'S256',
  });
});

void test('takes the id of the user and their primary verified email', async (): Promise<void> => {
  server.reply('GET', '/user/emails', {
    status: 200,
    body: [
      { email: 'old@example.com', primary: false, verified: true, visibility: null },
      { email: 'jane@example.com', primary: true, verified: true, visibility: 'public' },
    ],
  });

  assert.deepEqual(await github.fetchProfile(exchange), {
    subject: '42',
    email: 'jane@example.com',
    emailVerified: true,
  });

  const request = server.requests.findLast((item): boolean => item.path === '/user');
  assert.ok(request);
  assert.equal(request.headers.authorization, 'Bearer token-1');
  assert.equal(request.headers.accept, 'application/vnd.github+json');
  assert.ok((request.headers['user-agent'] ?? '') !== '');
});

void test('vouches for no email unless GitHub has verified the primary one', async (): Promise<void> => {
  const none = { subject: '42', email: null, emailVerified: false };

  server.reply('GET', '/user/emails', {
    status: 200,
    body: [{ email: 'jane@example.com', primary: true, verified: false, visibility: null }],
  });
  assert.deepEqual(await github.fetchProfile(exchange), none);

  server.reply('GET', '/user/emails', { status: 200, body: [] });
  assert.deepEqual(await github.fetchProfile(exchange), none);

  server.reply('GET', '/user/emails', { status: 404, body: { message: 'Not Found' } });
  assert.deepEqual(await github.fetchProfile(exchange), none);
});

void test('refuses a user it cannot read', async (): Promise<void> => {
  server.reply('GET', '/user', { status: 401, body: { message: 'Bad credentials' } });
  await assert.rejects(github.fetchProfile(exchange), OauthLoginFailedError);

  server.reply('GET', '/user', { status: 200, body: { login: 'jane' } });
  await assert.rejects(github.fetchProfile(exchange), OauthLoginFailedError);
});
