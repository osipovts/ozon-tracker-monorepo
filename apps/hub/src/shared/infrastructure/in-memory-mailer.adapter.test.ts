import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryMailerAdapter } from './in-memory-mailer.adapter.js';
import { LogMailerAdapter } from './log-mailer.adapter.js';

void test('keeps the messages it was given, in order', async (): Promise<void> => {
  const mailer = new InMemoryMailerAdapter();

  await mailer.send({ to: 'a@example.com', subject: 'one', text: 'first' });
  await mailer.send({ to: 'b@example.com', subject: 'two', text: 'second' });

  assert.deepEqual(
    mailer.sent.map((message): string => message.subject),
    ['one', 'two'],
  );
});

void test('writes a message to the log instead of sending it: for a hub with no mail service', async (): Promise<void> => {
  const lines: string[] = [];
  const note = (message: string): void => {
    lines.push(message);
  };
  const mailer = new LogMailerAdapter({
    error: note,
    warn: note,
    info: note,
    debug: note,
    verbose: note,
    child: () => {
      throw new Error('not used');
    },
  });

  await mailer.send({
    to: 'jane@example.com',
    subject: 'Confirm',
    text: 'Open https://x/y?token=abc',
  });

  assert.equal(lines.length, 1);
  assert.match(lines[0] ?? '', /jane@example\.com/);
  assert.match(lines[0] ?? '', /token=abc/);
});
