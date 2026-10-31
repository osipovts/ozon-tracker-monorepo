import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTransport } from 'nodemailer';
import { z } from 'zod';

import { NodemailerMailerAdapter } from './nodemailer-mailer.adapter.js';

const sentSchema = z.object({
  from: z.object({ address: z.string(), name: z.string() }),
  to: z.array(z.object({ address: z.string() })),
  subject: z.string(),
  text: z.string(),
});

void test('sends a plain text message from the address of the hub', async (): Promise<void> => {
  const outbox: string[] = [];
  // The JSON transport composes the message as a real transport would, and keeps it instead of sending it.
  const transport = createTransport({ jsonTransport: true });
  const adapter = new NodemailerMailerAdapter(
    {
      sendMail: async (options): Promise<unknown> => {
        const info = await transport.sendMail(options);
        outbox.push(info.message);

        return info;
      },
    },
    'Price Tracker <no-reply@hub.example.com>',
  );

  await adapter.send({
    to: 'jane@example.com',
    subject: 'Confirm your email',
    text: 'Open https://hub.example.com/auth/verify-email?token=abc',
  });

  const [message] = outbox.map((raw): z.infer<typeof sentSchema> =>
    sentSchema.parse(JSON.parse(raw)),
  );
  assert.deepEqual(message, {
    from: { address: 'no-reply@hub.example.com', name: 'Price Tracker' },
    to: [{ address: 'jane@example.com' }],
    subject: 'Confirm your email',
    text: 'Open https://hub.example.com/auth/verify-email?token=abc',
  });
});

void test('refuses when the mail service does not take the message', async (): Promise<void> => {
  const adapter = new NodemailerMailerAdapter(
    { sendMail: (): Promise<unknown> => Promise.reject(new Error('connection refused')) },
    'no-reply@hub.example.com',
  );

  await assert.rejects(
    adapter.send({ to: 'jane@example.com', subject: 's', text: 't' }),
    /connection refused/,
  );
});
