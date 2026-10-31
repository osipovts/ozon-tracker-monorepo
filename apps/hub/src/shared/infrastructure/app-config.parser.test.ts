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

  for (const target of ['https://evil.example', '//evil.example', '/\\evil.example', 'docs']) {
    assert.throws(() => parser.parse(env(['AUTH_SUCCESS_REDIRECT', target])), target);
  }
});

void test('takes the origins that may write to the hub besides itself, as a browser writes them', (): void => {
  assert.deepEqual(parser.parse(env()).authAllowedOrigins, []);
  assert.deepEqual(
    parser.parse(env(['AUTH_ALLOWED_ORIGINS', 'https://app.example.com, http://localhost:5173']))
      .authAllowedOrigins,
    ['https://app.example.com', 'http://localhost:5173'],
  );

  for (const origin of [
    'app.example.com',
    'https://app.example.com/',
    'https://app.example.com/path',
    '*',
  ]) {
    assert.throws(() => parser.parse(env(['AUTH_ALLOWED_ORIGINS', origin])), origin);
  }
});

void test('trusts no proxy unless told how many stand in front of the hub', (): void => {
  assert.equal(parser.parse(env()).trustProxy, 0);
  assert.equal(parser.parse(env(['TRUST_PROXY', '1'])).trustProxy, 1);
  assert.throws(() => parser.parse(env(['TRUST_PROXY', 'true'])));
  assert.throws(() => parser.parse(env(['TRUST_PROXY', '-1'])));
});

void test('sends mail through the SMTP service it is given, and writes it to the log with none', (): void => {
  assert.equal(parser.parse(env()).smtpUrl, null);
  assert.equal(parser.parse(env(['SMTP_URL', ''])).smtpUrl, null);
  assert.equal(
    parser.parse(env(['SMTP_URL', 'smtp://user:secret@mail.example.com:587'])).smtpUrl,
    'smtp://user:secret@mail.example.com:587',
  );
  assert.throws(() => parser.parse(env(['SMTP_URL', 'http://mail.example.com'])));
  assert.equal(parser.parse(env()).emailVerificationTtlMs, 86_400_000);
});

void test('refreshes the prices every quarter of an hour of those older than six hours, and can be turned off', (): void => {
  const config = parser.parse(env());

  assert.equal(config.priceRefreshIntervalMs, 15 * 60_000);
  assert.equal(config.priceRefreshMaxAgeMs, 6 * 60 * 60_000);
  assert.equal(config.priceRefreshBatchSize, 200);
  assert.equal(parser.parse(env(['PRICE_REFRESH_INTERVAL_MS', '0'])).priceRefreshIntervalMs, 0);
  assert.throws(() => parser.parse(env(['PRICE_REFRESH_MAX_AGE_MS', '10'])));
});

void test('takes the administrators of the hub from a list of emails, normalized', (): void => {
  assert.deepEqual(parser.parse(env()).adminEmails, []);
  assert.deepEqual(
    parser.parse(env(['ADMIN_EMAILS', ' Boss@Example.com , second@example.com,'])).adminEmails,
    ['boss@example.com', 'second@example.com'],
  );
  assert.throws(() => parser.parse(env(['ADMIN_EMAILS', 'not an email'])));
});

void test('serves no admin panel unless a directory of the built one is given', (): void => {
  assert.equal(parser.parse(env()).adminUiDir, null);
  assert.equal(parser.parse(env(['ADMIN_UI_DIR', ''])).adminUiDir, null);
  assert.equal(parser.parse(env(['ADMIN_UI_DIR', '/app/panel'])).adminUiDir, '/app/panel');
  assert.equal(parser.parse(env()).clientUiDir, null);
  assert.equal(parser.parse(env(['CLIENT_UI_DIR', '/app/client'])).clientUiDir, '/app/client');
});
