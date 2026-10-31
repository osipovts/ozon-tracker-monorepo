import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthenticateWithPasswordUseCase } from '../../account/application/authenticate-with-password.use-case.js';
import { NotifyExistingAccountUseCase } from '../../account/application/notify-existing-account.use-case.js';
import type { PasswordHasherPort } from '../../account/application/password-hasher.port.js';
import { RegisterAccountUseCase } from '../../account/application/register-account.use-case.js';
import { SendEmailVerificationUseCase } from '../../account/application/send-email-verification.use-case.js';
import { InMemoryAccountRegistrationAdapter } from '../../account/infrastructure/in-memory-account-registration.adapter.js';
import { InMemoryCredentialRepositoryAdapter } from '../../account/infrastructure/in-memory-credential-repository.adapter.js';
import { InMemoryEmailVerificationRepositoryAdapter } from '../../account/infrastructure/in-memory-email-verification-repository.adapter.js';
import { InMemoryUserRepositoryAdapter } from '../../account/infrastructure/in-memory-user-repository.adapter.js';
import type { MailerPort } from '../../shared/application/mailer.port.js';
import { TooManyRequestsError } from '../../shared/application/too-many-requests.error.js';
import { InMemoryMailerAdapter } from '../../shared/infrastructure/in-memory-mailer.adapter.js';
import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import { SignUpUseCase } from './sign-up.use-case.js';

const hasher: PasswordHasherPort = {
  hash: (password): Promise<string> => Promise.resolve(`hashed:${password}`),
  verify: (hash, password): Promise<boolean> => Promise.resolve(hash === `hashed:${password}`),
};

function setup(mailer: MailerPort = new InMemoryMailerAdapter()): {
  signUp: SignUpUseCase;
  authenticate: AuthenticateWithPasswordUseCase;
} {
  const users = new InMemoryUserRepositoryAdapter();
  const credentials = new InMemoryCredentialRepositoryAdapter();
  const registration = new InMemoryAccountRegistrationAdapter(users, credentials);

  return {
    signUp: new SignUpUseCase(
      new RegisterAccountUseCase(registration, hasher),
      new SendEmailVerificationUseCase(
        users,
        new InMemoryEmailVerificationRepositoryAdapter(),
        mailer,
        { linkBase: 'https://hub.example.com', ttlMs: 60_000 },
      ),
      new NotifyExistingAccountUseCase(mailer),
      new InMemoryRateLimiterAdapter(),
      { register: { limit: 2, windowMs: 60_000 }, notice: { limit: 1, windowMs: 60_000 } },
    ),
    authenticate: new AuthenticateWithPasswordUseCase(users, credentials, hasher),
  };
}

const from = (
  n: number,
  ip: string | null,
  email = `user-${String(n)}@example.com`,
  password = 'secret-pass',
): { email: string; password: string; ip: string | null } => ({ email, password, ip });

void test('signs the user up: they can log in afterwards, and a link to confirm the email is mailed to them', async (): Promise<void> => {
  const mailer = new InMemoryMailerAdapter();
  const { signUp, authenticate } = setup(mailer);

  await signUp.execute(from(1, '203.0.113.7', 'Jane@Example.com'));

  assert.equal(
    (await authenticate.execute({ email: 'jane@example.com', password: 'secret-pass' })).email,
    'jane@example.com',
  );
  assert.equal(mailer.sent.length, 1);
  const [mail] = mailer.sent;
  assert.ok(mail);
  assert.equal(mail.to, 'jane@example.com');
  assert.match(mail.text, /verify-email\?token=/);
});

void test('takes a taken email without a word, keeps the account as it was, and tells its holder instead', async (): Promise<void> => {
  const mailer = new InMemoryMailerAdapter();
  const { signUp, authenticate } = setup(mailer);
  await signUp.execute(from(1, null, 'jane@example.com', 'first-pass'));
  mailer.sent.length = 0;

  await signUp.execute(from(2, null, 'JANE@example.com', 'second-pass'));

  assert.equal(
    (await authenticate.execute({ email: 'jane@example.com', password: 'first-pass' })).email,
    'jane@example.com',
  );
  await assert.rejects(
    authenticate.execute({ email: 'jane@example.com', password: 'second-pass' }),
  );
  assert.deepEqual(
    mailer.sent.map((message): [string, boolean] => [message.to, message.text.includes('token=')]),
    [['jane@example.com', false]],
  );
});

void test('does not mail the holder over and over: whoever signs up again and again cannot use the hub to fill their mailbox', async (): Promise<void> => {
  const mailer = new InMemoryMailerAdapter();
  const { signUp } = setup(mailer);
  await signUp.execute(from(1, null, 'jane@example.com'));
  mailer.sent.length = 0;

  for (let tries = 0; tries < 5; tries += 1) {
    await signUp.execute(from(2, null, 'jane@example.com'));
  }

  assert.equal(mailer.sent.length, 1);
});

void test('a mail that cannot be sent does not fail the sign-up, nor tell a taken email from a free one', async (): Promise<void> => {
  const broken: MailerPort = {
    send: (): Promise<void> => Promise.reject(new Error('smtp is down')),
  };
  const { signUp, authenticate } = setup(broken);

  await signUp.execute(from(1, null, 'jane@example.com'));
  await signUp.execute(from(2, null, 'jane@example.com'));

  assert.equal(
    (await authenticate.execute({ email: 'jane@example.com', password: 'secret-pass' })).email,
    'jane@example.com',
  );
});

void test('stops an address that signs up too many users, and leaves the others alone', async (): Promise<void> => {
  const { signUp } = setup();

  await signUp.execute(from(1, '203.0.113.7'));
  await signUp.execute(from(2, '203.0.113.7'));
  await assert.rejects(signUp.execute(from(3, '203.0.113.7')), TooManyRequestsError);

  await signUp.execute(from(4, '198.51.100.9'));
  await signUp.execute(from(5, null));
  await signUp.execute(from(6, null));
  await signUp.execute(from(7, null));
});
