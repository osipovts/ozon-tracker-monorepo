import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CredentialEntity } from '../domain/credential.entity.js';
import { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import type { OauthProviderType } from '../domain/oauth-provider.type.js';
import { UserEntity } from '../domain/user.entity.js';
import { InMemoryCredentialRepositoryAdapter } from '../infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryLinkedIdentityRepositoryAdapter } from '../infrastructure/in-memory-linked-identity-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../infrastructure/in-memory-user-repository.adapter.js';
import { AccountDeletionNotConfirmedError } from './account-deletion-not-confirmed.error.js';
import { DeleteAccountUseCase } from './delete-account.use-case.js';
import { GetLinkedAccountsUseCase } from './get-linked-accounts.use-case.js';
import { IdentityNotFoundError } from './identity-not-found.error.js';
import { LastLoginMethodError } from './last-login-method.error.js';
import { UnlinkIdentityUseCase } from './unlink-identity.use-case.js';

const at = new Date('2026-10-31T10:00:00Z');
const jane = UserEntity.register('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11', 'jane@example.com', at);
const sam = UserEntity.register('6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22', 'sam@example.com', at);

function identity(
  user: UserEntity,
  provider: OauthProviderType,
  minute: number,
): LinkedIdentityEntity {
  return new LinkedIdentityEntity({
    id: crypto.randomUUID(),
    userId: user.snapshot.id,
    provider,
    subject: `${provider}-${user.snapshot.id}`,
    createdAt: new Date(at.getTime() + minute * 60_000),
  });
}

async function setup(): Promise<{
  users: InMemoryUserRepositoryAdapter;
  credentials: InMemoryCredentialRepositoryAdapter;
  identities: InMemoryLinkedIdentityRepositoryAdapter;
}> {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const identities = new InMemoryLinkedIdentityRepositoryAdapter();
  await users.add(jane);
  await users.add(sam);
  // Jane has a password and both providers; Sam has Google only.
  await credentials.save(new CredentialEntity({ userId: jane.snapshot.id, passwordHash: 'hash' }));
  await identities.add(identity(jane, 'github', 5));
  await identities.add(identity(jane, 'google', 1));
  await identities.add(identity(sam, 'google', 2));

  return { users, credentials, identities };
}

void test('lists the ways to log in: the password, and the providers the oldest first', async (): Promise<void> => {
  const { credentials, identities } = await setup();
  const list = new GetLinkedAccountsUseCase(credentials, identities);

  const janes = await list.execute(jane.snapshot.id);
  assert.equal(janes.hasPassword, true);
  assert.deepEqual(
    janes.identities.map(({ provider }): string => provider),
    ['google', 'github'],
  );
  assert.deepEqual(await list.execute(sam.snapshot.id), {
    hasPassword: false,
    identities: [{ provider: 'google', linkedAt: new Date(at.getTime() + 2 * 60_000) }],
  });
});

void test('unlinks a provider, and keeps the others and the other users', async (): Promise<void> => {
  const { credentials, identities } = await setup();
  const unlink = new UnlinkIdentityUseCase(credentials, identities);

  await unlink.execute(jane.snapshot.id, 'github');

  assert.deepEqual(
    (await identities.listByUser(jane.snapshot.id)).map(
      ({ snapshot }): string => snapshot.provider,
    ),
    ['google'],
  );
  assert.equal((await identities.listByUser(sam.snapshot.id)).length, 1);
});

void test('refuses to take away the last way to log in, and a link there is none of', async (): Promise<void> => {
  const { credentials, identities } = await setup();
  const unlink = new UnlinkIdentityUseCase(credentials, identities);

  // Sam logs in through Google only.
  await assert.rejects(unlink.execute(sam.snapshot.id, 'google'), LastLoginMethodError);
  assert.equal((await identities.listByUser(sam.snapshot.id)).length, 1);
  await assert.rejects(unlink.execute(sam.snapshot.id, 'github'), IdentityNotFoundError);

  // With a password the last provider can go.
  await unlink.execute(jane.snapshot.id, 'github');
  await unlink.execute(jane.snapshot.id, 'google');
  assert.equal((await identities.listByUser(jane.snapshot.id)).length, 0);
});

void test('deletes the account once its email is written, in any case, and not for another one', async (): Promise<void> => {
  const { users } = await setup();
  const deletion = new DeleteAccountUseCase(users);

  await assert.rejects(
    deletion.execute(jane.snapshot.id, 'sam@example.com'),
    AccountDeletionNotConfirmedError,
  );
  assert.notEqual(await users.findById(jane.snapshot.id), null);

  assert.equal(await deletion.execute(jane.snapshot.id, '  Jane@Example.com '), true);
  assert.equal(await users.findById(jane.snapshot.id), null);
  assert.notEqual(await users.findById(sam.snapshot.id), null);
  assert.equal(await deletion.execute(jane.snapshot.id, 'jane@example.com'), false);
});
