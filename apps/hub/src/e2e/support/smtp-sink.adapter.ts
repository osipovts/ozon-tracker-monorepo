import { simpleParser } from 'mailparser';
import { SMTPServer } from 'smtp-server';

export interface MailInterface {
  to: string[];
  subject: string;
  text: string;
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve): void => {
    setTimeout(resolve, ms);
  });

/** A real SMTP server on a free port that keeps the mail it is given, for the hub to send through. */
export class SmtpSinkAdapter {
  readonly mails: MailInterface[] = [];
  private readonly server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS', 'AUTH'],
    onData: (stream, _session, done): void => {
      simpleParser(stream).then(
        (parsed): void => {
          const to = [parsed.to ?? []]
            .flat()
            .flatMap((group): string[] => group.value.map((entry): string => entry.address ?? ''));
          this.mails.push({ to, subject: parsed.subject ?? '', text: parsed.text ?? '' });
          done();
        },
        (error: unknown): void => {
          done(error instanceof Error ? error : new Error('unreadable mail'));
        },
      );
    },
  });

  /** The URL to give the hub as SMTP_URL. */
  async start(port: number): Promise<string> {
    await new Promise<void>((resolve): void => {
      this.server.listen(port, '127.0.0.1', resolve);
    });

    return `smtp://127.0.0.1:${String(port)}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve): void => {
      this.server.close((): void => {
        resolve();
      });
    });
  }

  /** The mail that arrives to the address, the one that comes after `already` mails of it. */
  async waitFor(to: string, already = 0, timeoutMs = 10_000): Promise<MailInterface> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const mail = this.mails.filter((candidate): boolean => candidate.to.includes(to))[already];
      if (mail !== undefined) return mail;

      await wait(50);
    }

    throw new Error(`No mail to ${to} came in ${String(timeoutMs)} ms`);
  }

  countTo(to: string): number {
    return this.mails.filter((mail): boolean => mail.to.includes(to)).length;
  }
}

/** The path and the query of the link to confirm an email in a mail, as the person would follow it. */
export function verificationLinkOf(mail: MailInterface): string {
  const link = /https?:\/\/[^/\s]+(\/auth\/verify-email\?token=[A-Za-z0-9_-]+)/.exec(
    mail.text,
  )?.[1];
  if (link === undefined) throw new Error(`No verification link in the mail "${mail.subject}"`);

  return link;
}
