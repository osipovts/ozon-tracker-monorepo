import { randomUUID } from 'node:crypto';

import { CredentialEntity } from '../domain/credential.entity.js';
import { UserEntity, type UserInterface } from '../domain/user.entity.js';
import type { AccountRegistrationPort } from './account-registration.port.js';
import { EmailTakenError } from './email-taken.error.js';
import type { PasswordHasherPort } from './password-hasher.port.js';

export interface RegisterAccountInterface {
  email: string;
  password: string;
}

/** Signs a user up by the login and password; the password is kept as a hash only. */
export class RegisterAccountUseCase {
  constructor(
    private readonly registration: AccountRegistrationPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute({ email, password }: RegisterAccountInterface): Promise<UserInterface> {
    const user = UserEntity.register(randomUUID(), email, new Date());
    const credential = new CredentialEntity({
      userId: user.snapshot.id,
      passwordHash: await this.hasher.hash(password),
    });

    if (!(await this.registration.registerWithPassword(user, credential))) {
      throw new EmailTakenError(user.snapshot.email);
    }

    return user.snapshot;
  }
}
