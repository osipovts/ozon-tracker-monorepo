import type { MailerPort } from '../../shared/application/mailer.port.js';
import { UserEntity } from '../domain/user.entity.js';

export class NotifyExistingAccountUseCase {
  constructor(private readonly mailer: MailerPort) {}

  /**
   * Tells the holder of an email that somebody signed up with it, which the somebody is not told: the
   * hub does not say who has an account, and the holder is the one it can tell.
   */
  async execute(email: string): Promise<void> {
    await this.mailer.send({
      to: UserEntity.normalizeEmail(email),
      subject: 'Someone tried to sign up with your email',
      text:
        'Somebody tried to sign up with this email, and it has an account already.\n\n' +
        'If it was you, log in with your password. If it was not, ignore this message: nothing has changed.',
    });
  }
}
