import type { LoggerPort } from 'logger';

import type { MailerPort, MailMessageInterface } from '../application/mailer.port.js';

/**
 * For a hub with no mail service set up (SMTP_URL): the message goes to the log, so that the link
 * in it can be followed by hand. Nothing reaches the person it was meant for.
 */
export class LogMailerAdapter implements MailerPort {
  constructor(private readonly logger: LoggerPort) {}

  send({ to, subject, text }: MailMessageInterface): Promise<void> {
    this.logger.info(`Mail to ${to} (not sent, SMTP_URL is not set): ${subject}\n${text}`);

    return Promise.resolve();
  }
}
