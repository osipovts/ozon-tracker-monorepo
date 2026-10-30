import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthSessionEntity, type AuthSessionPolicyInterface } from './auth-session.entity.js';

const minute = 60_000;
const policy: AuthSessionPolicyInterface = { idleTtlMs: 30 * minute, absoluteTtlMs: 60 * minute };
const start = new Date('2026-10-31T10:00:00Z');
const after = (minutes: number): Date => new Date(start.getTime() + minutes * minute);

function started(): AuthSessionEntity {
  return AuthSessionEntity.start(
    {
      id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
      userId: '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22',
      tokenHash: 'hash',
      userAgent: 'Mozilla/5.0',
      ip: '203.0.113.7',
    },
    policy,
    start,
  );
}

void test('a new session is active until it idles out', (): void => {
  const session = started();

  assert.equal(session.isActive(after(29)), true);
  assert.equal(session.isActive(after(30)), false);
});

void test('using a session pushes the idle expiry forward', (): void => {
  const session = started().touched(policy, after(20));

  assert.equal(session.isActive(after(49)), true);
  assert.equal(session.isActive(after(50)), false);
  assert.deepEqual(session.snapshot.lastSeenAt, after(20));
});

void test('a session ends at the absolute limit however active it is', (): void => {
  const session = started().touched(policy, after(25)).touched(policy, after(50));

  assert.deepEqual(session.snapshot.expiresAt, after(60));
  assert.equal(session.isActive(after(59)), true);
  assert.equal(session.isActive(after(60)), false);
});

void test('an expired or revoked session cannot be revived by using it', (): void => {
  const expired = started();
  assert.equal(expired.touched(policy, after(45)), expired);

  const revoked = started().revoked(after(5));
  assert.equal(revoked.touched(policy, after(6)), revoked);
  assert.equal(revoked.isActive(after(6)), false);
});

void test('revoking twice keeps the first revocation time', (): void => {
  const revoked = started().revoked(after(5));

  assert.equal(revoked.revoked(after(9)), revoked);
  assert.deepEqual(revoked.snapshot.revokedAt, after(5));
});
