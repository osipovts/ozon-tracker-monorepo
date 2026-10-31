import type { MailerPort, MailMessageInterface } from '../application/mailer.port.js';

/** What the adapter needs of a nodemailer transporter: the `sendMail` of any of them. */
export interface MailTransportInterface {
  sendMail(options: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

export class NodemailerMailerAdapter implements MailerPort {
  constructor(
    private readonly transport: MailTransportInterface,
    /** The sender, as an address or `Name <address>`. */
    private readonly from: string,
  ) {}

  async send({ to, subject, text }: MailMessageInterface): Promise<void> {
    await this.transport.sendMail({ from: this.from, to, subject, text });
  }
}
