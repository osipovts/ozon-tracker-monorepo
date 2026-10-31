import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { z } from 'zod';

import type { OauthProviderType } from '../account/application/index.js';
import type { OauthProviderPort } from '../auth/application/oauth-provider.port.js';
import { GithubOauthProviderAdapter } from '../auth/infrastructure/github-oauth-provider.adapter.js';
import { GoogleOauthProviderAdapter } from '../auth/infrastructure/google-oauth-provider.adapter.js';
import { DockerStackAdapter } from './support/docker-stack.adapter.js';
import { FakeIdentityProviderAdapter } from './support/fake-identity-provider.adapter.js';
import type { HttpClientAdapter } from './support/http-client.adapter.js';
import { connectDatabase, type RunningHubInterface, startHub } from './support/hub-harness.js';

/**
 * What a user can do with their account: see how they log in, unlink a provider, and delete the account
 * for good, with the products only they track. Over a real Postgres, whose cascades do the deleting.
 */
const stack = new DockerStackAdapter();
const provider = new FakeIdentityProviderAdapter();
let hub: RunningHubInterface;
let database: ReturnType<typeof connectDatabase>;

const accountSchema = z.object({
  email: z.string(),
  emailVerified: z.boolean(),
  hasPassword: z.boolean(),
  identities: z.array(z.object({ provider: z.string(), linkedAt: z.string() })),
});

before(
  async (): Promise<void> => {
    const [infrastructure] = await Promise.all([stack.start(), provider.start()]);
    database = connectDatabase(infrastructure.databaseUrl);
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
    await database.$disconnect();
    await stack.stop();
  },
  { timeout: 60_000 },
);

async function accountOf(browser: HttpClientAdapter): Promise<z.infer<typeof accountSchema>> {
  const reply = await browser.request('/auth/account');
  assert.equal(reply.status, 200);

  return accountSchema.parse(reply.body);
}

/** A user with a password, whose email is proven, logged in. */
async function passwordUser(email: string): Promise<HttpClientAdapter> {
  const browser = hub.browser();
  await browser.request('/auth/register', { json: { email, password: 'correct-horse' } });
  await database.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  await browser.request('/auth/login', { json: { email, password: 'correct-horse' } });

  return browser;
}

void test('shows how the user logs in, and unlinks a provider that is not the last way in', async (): Promise<void> => {
  const jane = await passwordUser('jane@example.com');
  assert.deepEqual(await accountOf(jane), {
    email: 'jane@example.com',
    emailVerified: true,
    hasPassword: true,
    identities: [],
  });

  // Google proves the same email: the login through it joins the account.
  provider.profile = { subject: 'g-1', email: 'jane@example.com', emailVerified: true };
  await jane.browse('/auth/oauth/google/start');
  provider.profile = { subject: '2001', email: 'jane@example.com', emailVerified: true };
  await jane.browse('/auth/oauth/github/start');
  const linked = await accountOf(jane);
  assert.deepEqual(linked.identities.map((item): string => item.provider).toSorted(), [
    'github',
    'google',
  ]);

  assert.equal((await jane.request('/auth/identities/google', { method: 'DELETE' })).status, 204);
  assert.deepEqual(
    (await accountOf(jane)).identities.map((item): string => item.provider),
    ['github'],
  );
  assert.equal((await jane.request('/auth/identities/google', { method: 'DELETE' })).status, 404);

  // With a password, the last provider can go too.
  assert.equal((await jane.request('/auth/identities/github', { method: 'DELETE' })).status, 204);
  assert.deepEqual((await accountOf(jane)).identities, []);
});

void test('does not take the last way to log in from a user who has no password', async (): Promise<void> => {
  provider.profile = { subject: '2002', email: 'bob@example.com', emailVerified: true };
  const bob = hub.browser();
  await bob.browse('/auth/oauth/github/start');

  const account = await accountOf(bob);
  assert.equal(account.hasPassword, false);
  assert.equal(account.identities.length, 1);
  const refused = await bob.request('/auth/identities/github', { method: 'DELETE' });
  assert.equal(refused.status, 409);
  assert.equal((await accountOf(bob)).identities.length, 1);
});

void test('deletes the account with the sessions and the products only the user tracks, and keeps the shared ones', async (): Promise<void> => {
  const alice = await passwordUser('alice@example.com');
  const other = await passwordUser('carol@example.com');
  const [alicesId, carolsId] = await Promise.all([
    database.user
      .findUniqueOrThrow({ where: { email: 'alice@example.com' } })
      .then((user) => user.id),
    database.user
      .findUniqueOrThrow({ where: { email: 'carol@example.com' } })
      .then((user) => user.id),
  ]);
  const product = async (externalId: string): Promise<string> => {
    const created = await database.trackedProduct.create({
      data: {
        marketplace: 'ozon',
        externalId,
        url: `https://www.ozon.ru/product/${externalId}/`,
      },
    });
    await database.priceObservation.create({
      data: {
        trackedProductId: created.id,
        jobId: randomUUID(),
        title: externalId,
        observedAt: new Date(),
        availability: 'in_stock',
        prices: [{ amountMinor: 100_00, currency: 'RUB' }],
      },
    });

    return created.id;
  };
  const [aliceOnly, shared] = [await product('1001'), await product('1002')];
  await database.productSubscription.createMany({
    data: [
      { userId: alicesId, trackedProductId: aliceOnly },
      { userId: alicesId, trackedProductId: shared },
      { userId: carolsId, trackedProductId: shared },
    ],
  });

  // Another email is no confirmation, and nothing is lost.
  const refused = await alice.request('/auth/account', {
    method: 'DELETE',
    json: { email: 'carol@example.com' },
  });
  assert.equal(refused.status, 400);
  assert.equal((await alice.request('/auth/me')).status, 200);
  assert.equal(await database.productSubscription.count({ where: { userId: alicesId } }), 2);

  // The email of the account, in any case, is.
  const deleted = await alice.request('/auth/account', {
    method: 'DELETE',
    json: { email: 'Alice@Example.com' },
  });
  assert.equal(deleted.status, 204);

  assert.equal((await alice.request('/auth/me')).status, 401);
  assert.equal(await database.user.count({ where: { id: alicesId } }), 0);
  assert.equal(await database.credential.count({ where: { userId: alicesId } }), 0);
  assert.equal(await database.authSession.count({ where: { userId: alicesId } }), 0);
  assert.equal(await database.productSubscription.count({ where: { userId: alicesId } }), 0);

  // The product only Alice tracked is gone with its prices; the shared one stays for Carol.
  assert.equal(await database.trackedProduct.count({ where: { id: aliceOnly } }), 0);
  assert.equal(
    await database.priceObservation.count({ where: { trackedProductId: aliceOnly } }),
    0,
  );
  assert.equal(await database.trackedProduct.count({ where: { id: shared } }), 1);
  assert.equal(await database.productSubscription.count({ where: { userId: carolsId } }), 1);
  assert.equal((await other.request('/auth/me')).status, 200);
});
