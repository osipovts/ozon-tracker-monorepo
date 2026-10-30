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

  static register(id: string, email: string, createdAt: Date): UserEntity {
    return new UserEntity({
      id,
      email: UserEntity.normalizeEmail(email),
      emailVerifiedAt: null,
      createdAt,
    });
  }
}
