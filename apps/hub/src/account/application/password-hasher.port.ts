export const PASSWORD_HASHER = Symbol('PasswordHasherPort');

export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
  /** Tells whether the hash was made of the password; a hash it cannot read is no match. */
  verify(passwordHash: string, password: string): Promise<boolean>;
}
