import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import type { OauthProviderType } from '../account/application/index.js';
import type { OauthProviderPort } from '../auth/application/oauth-provider.port.js';
import { GithubOauthProviderAdapter } from '../auth/infrastructure/github-oauth-provider.adapter.js';
import { GoogleOauthProviderAdapter } from '../auth/infrastructure/google-oauth-provider.adapter.js';
import { authResponseSchema } from '../auth/presentation/auth.type.js';
import { DockerStackAdapter } from './support/docker-stack.adapter.js';
import { FakeIdentityProviderAdapter } from './support/fake-identity-provider.adapter.js';
import type { HttpClientAdapter } from './support/http-client.adapter.js';
import { type RunningHubInterface, startHub } from './support/hub-harness.js';

/**
 * The login through Google and GitHub, over real HTTP and real redirects. The providers themselves cannot
 * be reached from a test, so a server of ours stands in for them with their endpoints, and checks the
 * PKCE verifier and the client secret the hub sends, as they do.
 */
const stack = new DockerStackAdapter();
const provider = new FakeIdentityProviderAdapter();
let hub: RunningHubInterface;

before(
  async (): Promise<void> => {
    const [infrastructure] = await Promise.all([stack.start(), provider.start()]);
    const credentials = { clientId: provider.clientId, clientSecret: provider.clientSecret };
    const providers = new Map<OauthProviderType, OauthProviderPort>();
    providers.set(
      'google',
      new GoogleOauthProviderAdapter(credentials, provider.googleEndpoints()),
    );
    providers.set(
      'github',
      new GithubOauthProviderAdapter(credentials, provider.githubEndpoints()),
    );
    hub = await startHub({ stack: infrastructure, oauthProviders: providers });
  },
  { timeout: 120_000 },
);

after(
  async (): Promise<void> => {
    await hub.stop();
    await provider.stop();
    await stack.stop();
  },
  { timeout: 60_000 },
);

/** The browser goes to the login of a provider, and is led through it and back to the hub as one is. */
function logInWith(
  browser: HttpClientAdapter,
  name: 'google' | 'github',
): ReturnType<HttpClientAdapter['browse']> {
  return browser.browse(`/auth/oauth/${name}/start`);
}

async function whoIs(
  browser: HttpClientAdapter,
): Promise<{ id: string; email: string; verified: boolean } | null> {
  const reply = await browser.request('/auth/me');
  if (reply.status !== 200) return null;
  const { user } = authResponseSchema.parse(reply.body);

  return { id: user.id, email: user.email, verified: user.emailVerified };
}

void test('a first login through Google signs the user up, with the email Google vouches for', async (): Promise<void> => {
  provider.profile = { subject: '1001', email: 'jane@example.com', emailVerified: true };
  const browser = hub.browser();

  const landed = await logInWith(browser, 'google');

  assert.equal(landed.status, 200);
  assert.deepEqual(await whoIs(browser), {
    id: authResponseSchema.parse(landed.body).user.id,
    email: 'jane@example.com',
    verified: true,
  });

  // The same Google account on another device is the same user.
  const other = hub.browser();
  await logInWith(other, 'google');
  assert.equal((await whoIs(other))?.id, (await whoIs(browser))?.id);
});

void test('GitHub with the same verified email joins the user instead of making a second one', async (): Promise<void> => {
  provider.profile = { subject: '2002', email: 'sam@example.com', emailVerified: true };
  const viaGoogle = hub.browser();
  await logInWith(viaGoogle, 'google');

  const viaGithub = hub.browser();
  await logInWith(viaGithub, 'github');

  const [google, github] = [await whoIs(viaGoogle), await whoIs(viaGithub)];
  assert.ok(google && github);
  assert.equal(github.id, google.id);
});

void test('a provider that proves an email takes over the unproven password account of it, and its owner is logged out', async (): Promise<void> => {
  const squatter = hub.browser();
  await squatter.request('/auth/register', {
    json: { email: 'ann@example.com', password: 'squatter-pass-1' },
  });
  await squatter.request('/auth/login', {
    json: { email: 'ann@example.com', password: 'squatter-pass-1' },
  });
  assert.notEqual(await whoIs(squatter), null);

  provider.profile = { subject: '3003', email: 'ann@example.com', emailVerified: true };
  const owner = hub.browser();
  const landed = await logInWith(owner, 'google');

  assert.equal(landed.status, 200);
  assert.equal((await whoIs(owner))?.verified, true);
  assert.equal(await whoIs(squatter), null);
  assert.equal(
    (
      await hub
        .browser()
        .request('/auth/login', { json: { email: 'ann@example.com', password: 'squatter-pass-1' } })
    ).status,
    401,
  );
});

void test('does not log in a user whose email the provider does not vouch for, nor one who refuses at the provider', async (): Promise<void> => {
  provider.profile = { subject: '4004', email: 'new@example.com', emailVerified: false };
  const unproven = hub.browser();
  assert.equal((await logInWith(unproven, 'google')).status, 401);
  assert.equal(await whoIs(unproven), null);

  provider.profile = { subject: '5005', email: 'dan@example.com', emailVerified: true };
  provider.deny = true;
  try {
    const refused = hub.browser();
    assert.equal((await logInWith(refused, 'github')).status, 401);
    assert.equal(await whoIs(refused), null);
  } finally {
    provider.deny = false;
  }
});

void test('does not take a callback that was not asked for from this browser', async (): Promise<void> => {
  const browser = hub.browser();

  // No login was started here: there is no secret of one in the cookies.
  assert.equal(
    (await browser.request('/auth/oauth/google/callback?code=anything&state=forged')).status,
    401,
  );

  // One was started, and the callback answers another: the state is wrong.
  const started = await browser.request('/auth/oauth/google/start');
  assert.equal(started.status, 302);
  assert.equal(
    (await browser.request('/auth/oauth/google/callback?code=anything&state=forged')).status,
    401,
  );
  assert.equal(await whoIs(browser), null);

  // A provider that is not set up is not there.
  assert.equal((await browser.request('/auth/oauth/facebook/start')).status, 400);
});
