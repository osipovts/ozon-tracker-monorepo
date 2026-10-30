import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { OauthLoginFailedError } from '../application/oauth-login-failed.error.js';
import { FakeHttpServerAdapter } from './fake-http-server.adapter.js';
import { OauthTokenExchangeAdapter } from './oauth-token-exchange.adapter.js';

const server = new FakeHttpServerAdapter();
let exchange: OauthTokenExchangeAdapter;

before(async (): Promise<void> => {
  const base = await server.start();
  exchange = new OauthTokenExchangeAdapter({
    tokenUrl: `${base}/token`,
    clientId: 'client-1',
    clientSecret: 'secret-1',
  });
});

after(async (): Promise<void> => {
  await server.stop();
});

const input = { code: 'code-1', codeVerifier: 'verifier-1', redirectUri: 'http://hub/callback' };

void test('trades the code and the PKCE verifier for the access token, as a form post', async (): Promise<void> => {
  server.reply('POST', '/token', {
    status: 200,
    body: { access_token: 'token-1', token_type: 'bearer' },
  });

  assert.equal(await exchange.exchange(input), 'token-1');

  const request = server.requests.at(-1);
  assert.ok(request);
  assert.equal(request.method, 'POST');
  assert.match(request.headers['content-type'] ?? '', /^application\/x-www-form-urlencoded/);
  assert.equal(request.headers.accept, 'application/json');
  assert.deepEqual(Object.fromEntries(new URLSearchParams(request.body)), {
    client_id: 'client-1',
    client_secret: 'secret-1',
    code: 'code-1',
    code_verifier: 'verifier-1',
    redirect_uri: 'http://hub/callback',
    grant_type: 'authorization_code',
  });
});

void test('names the refusal of the provider, whether it comes as an error status or as a 200 with an error', async (): Promise<void> => {
  server.reply('POST', '/token', { status: 400, body: { error: 'invalid_grant' } });
  await assert.rejects(exchange.exchange(input), /invalid_grant/);

  server.reply('POST', '/token', { status: 200, body: { error: 'bad_verification_code' } });
  await assert.rejects(exchange.exchange(input), OauthLoginFailedError);

  server.reply('POST', '/token', { status: 200, body: { nothing: 'useful' } });
  await assert.rejects(exchange.exchange(input), OauthLoginFailedError);
});

void test('does not echo the client secret anywhere in its errors', async (): Promise<void> => {
  server.reply('POST', '/token', { status: 400, body: { error: 'invalid_client' } });

  await assert.rejects(exchange.exchange(input), (error: unknown): boolean => {
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes('secret-1'));

    return true;
  });
});

void test('says the provider could not be reached instead of a bare network error', async (): Promise<void> => {
  const unreachable = new OauthTokenExchangeAdapter({
    tokenUrl: 'http://127.0.0.1:1/token',
    clientId: 'c',
    clientSecret: 's',
  });

  await assert.rejects(unreachable.exchange(input), /could not be reached/);
});
