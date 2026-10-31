import { CredentialEntity } from '../domain/credential.entity.js';
import type { CredentialRepositoryPort } from './credential-repository.port.js';
import type { PasswordHasherPort } from './password-hasher.port.js';
import { WrongPasswordError } from './wrong-password.error.js';

export interface ChangeAccountPasswordInterface {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangeAccountPasswordUseCase {
  constructor(
    private readonly credentials: CredentialRepositoryPort,
    private readonly hasher: PasswordHasherPort,
  ) {}

  /** Replaces the password once the current one is proven: a session alone is not enough to change it. */
  async execute({
    userId,
    currentPassword,
    newPassword,
  }: ChangeAccountPasswordInterface): Promise<void> {
    const credential = await this.credentials.findByUserId(userId);
    // A user who signs in through a provider only has no password to prove.
    if (
      credential === null ||
      !(await this.hasher.verify(credential.snapshot.passwordHash, currentPassword))
    ) {
      throw new WrongPasswordError();
    }

    await this.credentials.save(
      new CredentialEntity({ userId, passwordHash: await this.hasher.hash(newPassword) }),
    );
  }
}
