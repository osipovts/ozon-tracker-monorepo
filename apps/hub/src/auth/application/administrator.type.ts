import { normalizeEmail, type UserInterface } from '../../account/application/index.js';

/**
 * An administrator is a user whose email is in the list of the hub and is proven to be theirs: signing
 * up with an administrator's email, which nobody checks, makes nobody one.
 */
export function isAdministrator(user: UserInterface, adminEmails: readonly string[]): boolean {
  return user.emailVerifiedAt !== null && adminEmails.includes(normalizeEmail(user.email));
}
