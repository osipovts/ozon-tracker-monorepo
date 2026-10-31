import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SendEmailVerificationUseCase } from '../../account/application/send-email-verification.use-case.js';
import { UserEntity } from '../../account/domain/user.entity.js';
import { InMemoryEmailVerificationRepositoryAdapter } from '../../account/infrastructure/in-memory-email-verification-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../../account/infrastructure/in-memory-user-repository.adapter.js';
import { TooManyRequestsError } from '../../shared/application/too-many-requests.error.js';
import { InMemoryMailerAdapter } from '../../shared/infrastructure/in-memory-mailer.adapter.js';
import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import { ResendEmailVerificationUseCase } from './resend-email-verification.use-case.js';

const at = new Date('2026-10-31T10:00:00Z');
const jane = UserEntity.register('3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11', 'jane@example.com', at);

async function setup(): Promise<{
  resend: ResendEmailVerificationUseCase;
  mailer: InMemoryMailerAdapter;
}> {
  const users = new InMemoryUserRepositoryAdapter();
  await users.add(jane);
  const mailer = new InMemoryMailerAdapter();

  return {
    resend: new ResendEmailVerificationUseCase(
      new SendEmailVerificationUseCase(
        users,
        new InMemoryEmailVerificationRepositoryAdapter(),
        mailer,
        {
          linkBase: 'https://hub.example.com',
          ttlMs: 60_000,
        },
      ),
      new InMemoryRateLimiterAdapter(),
      { limit: 2, windowMs: 60_000 },
    ),
    mailer,
  };
}

void test('mails the link again, so many times a window, and then makes the user wait', async (): Promise<void> => {
  const { resend, mailer } = await setup();

  await resend.execute(jane.snapshot.id);
  await resend.execute(jane.snapshot.id);
  await assert.rejects(resend.execute(jane.snapshot.id), TooManyRequestsError);

  assert.equal(mailer.sent.length, 2);
});
