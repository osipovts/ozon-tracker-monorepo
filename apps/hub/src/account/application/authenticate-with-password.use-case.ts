import { randomUUID } from 'node:crypto';

import { UserEntity, type UserInterface } from '../domain/user.entity.js';
import type { CredentialRepositoryPort } from './credential-repository.port.js';
import { InvalidCredentialsError } from './invalid-credentials.error.js';
import type { PasswordHasherPort } from './password-hasher.port.js';
import type { UserRepositoryPort } from './user-repository.port.js';

export interface PasswordLoginInterface {
  email: string;
  password: string;
}

/** Tells the user of the email and the password; the refusal never tells which of them was wrong. */
export class AuthenticateWithPasswordUseCase {
  private decoyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UserRepositoryPort,
    private readonly credentials: CredentialRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute({ email, password }: PasswordLoginInterface): Promise<UserInterface> {
    const user = await this.users.findByEmail(UserEntity.normalizeEmail(email));
    const credential = user === null ? null : await this.credentials.findByUserId(user.snapshot.id);

    // Without a password to check, a decoy takes the same time: the speed of the answer tells nothing.
    const matches = await this.hasher.verify(
      credential?.snapshot.passwordHash ?? (await this.decoy()),
      password,
    );
    if (user === null || credential === null || !matches) throw new InvalidCredentialsError();

    return user.snapshot;
  }

  private decoy(): Promise<string> {
    this.decoyHash ??= this.hasher.hash(randomUUID());

    return this.decoyHash;
  }
}
