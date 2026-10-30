import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import { InMemoryAccountRegistrationAdapter } from '../infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryLinkedIdentityRepositoryAdapter } from '../infrastructure/in-memory-linked-identity-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { AuthenticateWithPasswordUseCase } from './authenticate-with-password.use-case.js';
import { InvalidCredentialsError } from './invalid-credentials.error.js';
import { OauthEmailUnverifiedError } from './oauth-email-unverified.error.js';
import type { PasswordHasherPort } from './password-hasher.port.js';
import { RegisterAccountUseCase } from './register-account.use-case.js';
import { ResolveOauthAccountUseCase } from './resolve-oauth-account.use-case.js';

const hasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};

function setup(): {
  resolve: ResolveOauthAccountUseCase;
  register: RegisterAccountUseCase;
  authenticate: AuthenticateWithPasswordUseCase;
  users: InMemoryUserRepositoryAdapter;
  identities: InMemoryLinkedIdentityRepositoryAdapter;
} {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const identities = new InMemoryLinkedIdentityRepositoryAdapter();
  const registration = new InMemoryAccountRegistrationAdapter(users, credentials, identities);

  return {
    resolve: new ResolveOauthAccountUseCase(users, identities, registration),
    register: new RegisterAccountUseCase(registration, hasher),
    authenticate: new AuthenticateWithPasswordUseCase(users, credentials, hasher),
    users,
    identities,
  };
}

const google = {
  provider: 'google',
  subject: '1001',
  email: 'Jane@Example.com',
  emailVerified: true,
} as const;

void test('signs a new user up with the verified email of the provider', async (): Promise<void> => {
  const { resolve, users } = setup();

  const { user, claimed } = await resolve.execute(google);

  assert.equal(user.email, 'jane@example.com');
  assert.notEqual(user.emailVerifiedAt, null);
  assert.equal(claimed, false);
  assert.equal((await users.findByEmail('jane@example.com'))?.snapshot.id, user.id);
});

void test('the same provider account is the same user every time, whatever its email becomes', async (): Promise<void> => {
  const { resolve } = setup();
  const first = await resolve.execute(google);

  const again = await resolve.execute({ ...google, email: 'new-address@example.com' });

  assert.equal(again.user.id, first.user.id);
  assert.equal(again.user.email, 'jane@example.com');
  assert.equal(again.claimed, false);
});

void test('another provider with the same verified email joins the user instead of making a second one', async (): Promise<void> => {
  const { resolve } = setup();
  const first = await resolve.execute(google);
  const github = {
    provider: 'github',
    subject: '77',
    email: 'jane@example.com',
    emailVerified: true,
  } as const;

  const joined = await resolve.execute(github);
  const again = await resolve.execute(github);

  assert.equal(joined.user.id, first.user.id);
  assert.equal(again.user.id, first.user.id);
  assert.equal(joined.claimed, false);
});

void test("an email proven by a provider takes the password account of that email over: it was never proven to be its holder's", async (): Promise<void> => {
  const { resolve, register, authenticate, identities } = setup();
  const squatter = await register.execute({ email: 'jane@example.com', password: 'squatter-pass' });

  const { user, claimed } = await resolve.execute(google);

  assert.equal(claimed, true);
  assert.equal(user.id, squatter.id);
  assert.notEqual(user.emailVerifiedAt, null);
  assert.notEqual(await identities.findByProviderSubject('google', '1001'), null);
  // The password of whoever signed up first no longer opens the account.
  await assert.rejects(
    authenticate.execute({ email: 'jane@example.com', password: 'squatter-pass' }),
    InvalidCredentialsError,
  );

  const next = await resolve.execute(google);
  assert.equal(next.user.id, squatter.id);
  assert.equal(next.claimed, false);
});

void test('refuses a provider that does not vouch for the email, and takes nothing over', async (): Promise<void> => {
  const { resolve, register, authenticate, users } = setup();
  await register.execute({ email: 'jane@example.com', password: 'secret-pass' });

  await assert.rejects(
    resolve.execute({ ...google, emailVerified: false }),
    OauthEmailUnverifiedError,
  );
  await assert.rejects(resolve.execute({ ...google, email: null }), OauthEmailUnverifiedError);

  assert.equal(
    (await authenticate.execute({ email: 'jane@example.com', password: 'secret-pass' })).email,
    'jane@example.com',
  );
  assert.equal((await users.findByEmail('jane@example.com'))?.snapshot.emailVerifiedAt, null);
});

void test('a provider account whose user is gone is not logged in as nobody: its email is resolved afresh', async (): Promise<void> => {
  const { resolve, identities } = setup();
  await identities.add(
    new LinkedIdentityEntity({
      id: '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a',
      userId: '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33',
      provider: 'google',
      subject: '1001',
      createdAt: new Date(),
    }),
  );

  const { user } = await resolve.execute(google);

  assert.equal(user.email, 'jane@example.com');
  assert.notEqual(user.id, '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33');
});
