export const MAILER = Symbol('MailerPort');

export interface MailMessageInterface {
  to: string;
  subject: string;
  /** Plain text: the links in it are what the reader acts on. */
  text: string;
}

export interface MailerPort {
  /** Hands the message to the mail service; refuses (rejects) if it does not take it. */
  send(message: MailMessageInterface): Promise<void>;
}
