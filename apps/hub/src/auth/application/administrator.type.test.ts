import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UserInterface } from '../../account/application/index.js';
import { isAdministrator } from './administrator.type.js';

const at = new Date('2026-10-31T10:00:00Z');

function user(email: string, verified: boolean): UserInterface {
  return {
    id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
    email,
    emailVerifiedAt: verified ? at : null,
    createdAt: at,
  };
}

void test('an administrator is a user of the list whose email is proven to be theirs', (): void => {
  const admins = ['boss@example.com'];

  assert.equal(isAdministrator(user('boss@example.com', true), admins), true);
  assert.equal(isAdministrator(user('boss@example.com', false), admins), false);
  assert.equal(isAdministrator(user('other@example.com', true), admins), false);
  assert.equal(isAdministrator(user('boss@example.com', true), []), false);
});
