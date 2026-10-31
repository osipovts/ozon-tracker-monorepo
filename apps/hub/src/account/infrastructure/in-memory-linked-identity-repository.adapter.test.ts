import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import type { OauthProviderType } from '../domain/oauth-provider.type.js';
import { InMemoryLinkedIdentityRepositoryAdapter } from './in-memory-linked-identity-repository.adapter.js';

const createdAt = new Date('2026-10-31T10:00:00Z');

function identity(id: string, provider: OauthProviderType, subject: string): LinkedIdentityEntity {
  return new LinkedIdentityEntity({
    id,
    userId: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
    provider,
    subject,
    createdAt,
  });
}

void test('links a provider account once; another provider may use the same subject', async (): Promise<void> => {
  const identities = new InMemoryLinkedIdentityRepositoryAdapter();
  const google = identity('1', 'google', '42');

  assert.equal(await identities.add(google), true);
  assert.equal(await identities.add(identity('2', 'google', '42')), false);
  assert.equal(await identities.add(identity('3', 'github', '42')), true);

  assert.equal(await identities.findByProviderSubject('google', '42'), google);
  assert.equal(await identities.findByProviderSubject('google', '7'), null);
});
