import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AccountDeletionNotConfirmedError } from '../../account/application/index.js';
import { CloseAccountUseCase } from './close-account.use-case.js';

const user = {
  id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
  email: 'jane@example.com',
  emailVerifiedAt: null,
  createdAt: new Date('2026-10-31T10:00:00Z'),
};

function setup(): { close: CloseAccountUseCase; steps: string[] } {
  const steps: string[] = [];
  const close = new CloseAccountUseCase(
    { execute: (id): Promise<typeof user | null> => Promise.resolve(id === user.id ? user : null) },
    {
      execute: (id): Promise<void> => {
        steps.push(`products of ${id === user.id ? 'jane' : '?'}`);

        return Promise.resolve();
      },
    },
    {
      execute: (id, except): Promise<number> => {
        steps.push(
          `sessions of ${id === user.id ? 'jane' : '?'}, none kept: ${String(except === null)}`,
        );

        return Promise.resolve(2);
      },
    },
    {
      execute: (): Promise<boolean> => {
        steps.push('account');

        return Promise.resolve(true);
      },
    },
  );

  return { close, steps };
}

void test('removes the products, ends the sessions, and then deletes the account', async (): Promise<void> => {
  const { close, steps } = setup();

  assert.equal(await close.execute(user.id, 'JANE@example.com'), true);

  assert.deepEqual(steps, ['products of jane', 'sessions of jane, none kept: true', 'account']);
});

void test('deletes nothing when the email is not the one of the account', async (): Promise<void> => {
  const { close, steps } = setup();

  await assert.rejects(close.execute(user.id, 'sam@example.com'), AccountDeletionNotConfirmedError);

  assert.deepEqual(steps, []);
});

void test('says so when there is no such user', async (): Promise<void> => {
  const { close, steps } = setup();

  assert.equal(
    await close.execute('00000000-0000-4000-8000-000000000000', 'jane@example.com'),
    false,
  );
  assert.deepEqual(steps, []);
});
