import type { MailerPort, MailMessageInterface } from '../application/mailer.port.js';

export class InMemoryMailerAdapter implements MailerPort {
  readonly sent: MailMessageInterface[] = [];

  send(message: MailMessageInterface): Promise<void> {
    this.sent.push(message);

    return Promise.resolve();
  }
}
