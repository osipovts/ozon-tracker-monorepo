import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AppConfigParser } from './app-config.parser.js';

const parser = new AppConfigParser();

/** An environment with the database and the given variables, as pairs: their names are not ours to case. */
function env(...entries: Array<[string, string]>): NodeJS.ProcessEnv {
  return Object.fromEntries([['DATABASE_URL', 'postgresql://localhost:5432/hub'], ...entries]);
}

void test('defaults to a hub on localhost that logs in to /auth/me and has no provider set up', (): void => {
  const config = parser.parse(env());

  assert.equal(config.publicUrl, 'http://localhost:3000');
  assert.equal(config.authSuccessRedirect, '/auth/me');
  assert.equal(config.googleOauth, null);
  assert.equal(config.githubOauth, null);
  assert.equal(config.operatorApiKey, null);
});

void test('sets a provider up with both the id and the secret of its OAuth app, and treats empty values as unset', (): void => {
  const config = parser.parse(
    env(
      ['GOOGLE_CLIENT_ID', 'google-id'],
      ['GOOGLE_CLIENT_SECRET', 'google-secret'],
      ['GITHUB_CLIENT_ID', ''],
      ['GITHUB_CLIENT_SECRET', ''],
    ),
  );

  assert.deepEqual(config.googleOauth, { clientId: 'google-id', clientSecret: 'google-secret' });
  assert.equal(config.githubOauth, null);
});

void test('reports half of an OAuth app instead of silently leaving the login off', (): void => {
  assert.throws(() => parser.parse(env(['GITHUB_CLIENT_ID', 'github-id'])));
  assert.throws(() => parser.parse(env(['GITHUB_CLIENT_SECRET', 'github-secret'])));
});

void test('builds the callbacks from the public URL without a trailing slash', (): void => {
  assert.equal(
    parser.parse(env(['PUBLIC_URL', 'https://hub.example.com/'])).publicUrl,
    'https://hub.example.com',
  );
  assert.throws(() => parser.parse(env(['PUBLIC_URL', 'ftp://hub.example.com'])));
});

void test('lands the user on a path of the hub only: a login must not be sent anywhere else', (): void => {
  assert.equal(parser.parse(env(['AUTH_SUCCESS_REDIRECT', '/docs'])).authSuccessRedirect, '/docs');

  for (const target of ['https://evil.example', '//evil.example', 'docs']) {
    assert.throws(() => parser.parse(env(['AUTH_SUCCESS_REDIRECT', target])), target);
  }
});
