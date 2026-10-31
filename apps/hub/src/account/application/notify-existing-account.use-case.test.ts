import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryMailerAdapter } from '../../shared/infrastructure/in-memory-mailer.adapter.js';
import { NotifyExistingAccountUseCase } from './notify-existing-account.use-case.js';

void test('tells the holder of an account that somebody signed up with their email, and gives that somebody nothing', async (): Promise<void> => {
  const mailer = new InMemoryMailerAdapter();

  await new NotifyExistingAccountUseCase(mailer).execute('Jane@Example.com');

  assert.equal(mailer.sent.length, 1);
  const [mail] = mailer.sent;
  assert.ok(mail);
  assert.equal(mail.to, 'jane@example.com');
  assert.match(mail.text, /ignore/i);
  assert.doesNotMatch(mail.text, /token=/);
});
