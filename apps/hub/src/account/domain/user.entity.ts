export interface UserInterface {
  id: string;
  /** Trimmed and lowercase: the same address is never two users. */
  email: string;
  /** Null until the user proves the address is theirs. */
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export class UserEntity {
  constructor(readonly snapshot: UserInterface) {}

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** A user whose email a provider has vouched for. */
  static registerVerified(id: string, email: string, createdAt: Date): UserEntity {
    return new UserEntity({
      id,
      email: UserEntity.normalizeEmail(email),
      emailVerifiedAt: createdAt,
      createdAt,
    });
  }

  /** The same user with the email proven to be theirs, as of the first time it was. */
  verified(at: Date): UserEntity {
    return new UserEntity({
      ...this.snapshot,
      emailVerifiedAt: this.snapshot.emailVerifiedAt ?? at,
    });
  }

  static register(id: string, email: string, createdAt: Date): UserEntity {
    return new UserEntity({
      id,
      email: UserEntity.normalizeEmail(email),
      emailVerifiedAt: null,
      createdAt,
    });
  }
}
