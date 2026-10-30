import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryAccountRegistrationAdapter } from '../infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryLinkedIdentityRepositoryAdapter } from '../infrastructure/in-memory-linked-identity-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { EmailTakenError } from './email-taken.error.js';
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
  users: InMemoryUserRepositoryAdapter;
} {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const identities = new InMemoryLinkedIdentityRepositoryAdapter();
  const registration = new InMemoryAccountRegistrationAdapter(users, credentials, identities);

  return {
    resolve: new ResolveOauthAccountUseCase(users, identities, registration),
    register: new RegisterAccountUseCase(registration, hasher),
    users,
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

  const user = await resolve.execute(google);

  assert.equal(user.email, 'jane@example.com');
  assert.notEqual(user.emailVerifiedAt, null);
  assert.equal((await users.findByEmail('jane@example.com'))?.snapshot.id, user.id);
});

void test('the same provider account is the same user every time, whatever its email becomes', async (): Promise<void> => {
  const { resolve } = setup();
  const first = await resolve.execute(google);

  const again = await resolve.execute({ ...google, email: 'new-address@example.com' });

  assert.equal(again.id, first.id);
  assert.equal(again.email, 'jane@example.com');
});

void test('another provider with the same verified email joins the user instead of making a second one', async (): Promise<void> => {
  const { resolve } = setup();
  const first = await resolve.execute(google);

  const github = await resolve.execute({
    provider: 'github',
    subject: '77',
    email: 'jane@example.com',
    emailVerified: true,
  });
  const githubAgain = await resolve.execute({
    provider: 'github',
    subject: '77',
    email: 'jane@example.com',
    emailVerified: true,
  });

  assert.equal(github.id, first.id);
  assert.equal(githubAgain.id, first.id);
});

void test('an email of a password account is not taken over by a provider: its owner is not proven', async (): Promise<void> => {
  const { resolve, register } = setup();
  await register.execute({ email: 'jane@example.com', password: 'secret-pass' });

  await assert.rejects(resolve.execute(google), EmailTakenError);
});

void test('refuses a provider that does not vouch for the email', async (): Promise<void> => {
  const { resolve, users } = setup();

  await assert.rejects(
    resolve.execute({ ...google, emailVerified: false }),
    OauthEmailUnverifiedError,
  );
  await assert.rejects(resolve.execute({ ...google, email: null }), OauthEmailUnverifiedError);
  assert.equal(await users.findByEmail('jane@example.com'), null);
});
