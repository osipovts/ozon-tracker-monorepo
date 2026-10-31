/** What the other contexts may use of the account context. */
export type { OauthProviderType } from '../domain/oauth-provider.type.js';
export { oauthProviders } from '../domain/oauth-provider.type.js';
import { UserEntity } from '../domain/user.entity.js';

export type { UserInterface } from '../domain/user.entity.js';
export { AccountDeletionNotConfirmedError } from './account-deletion-not-confirmed.error.js';
export {
  AuthenticateWithPasswordUseCase,
  type PasswordLoginInterface,
} from './authenticate-with-password.use-case.js';
export {
  type ChangeAccountPasswordInterface,
  ChangeAccountPasswordUseCase,
} from './change-account-password.use-case.js';
export { DeleteAccountUseCase } from './delete-account.use-case.js';
export { EmailTakenError } from './email-taken.error.js';
export { GetAccountUseCase } from './get-account.use-case.js';
export {
  GetLinkedAccountsUseCase,
  type LinkedAccountsInterface,
} from './get-linked-accounts.use-case.js';
export { GetUserStatsUseCase, type UserStatsInterface } from './get-user-stats.use-case.js';
export { IdentityNotFoundError } from './identity-not-found.error.js';
export { LastLoginMethodError } from './last-login-method.error.js';
export { NotifyExistingAccountUseCase } from './notify-existing-account.use-case.js';
export {
  type RegisterAccountInterface,
  RegisterAccountUseCase,
} from './register-account.use-case.js';
export {
  type OauthAccountInterface,
  type OauthAccountResultInterface,
  ResolveOauthAccountUseCase,
} from './resolve-oauth-account.use-case.js';
export { SendEmailVerificationUseCase } from './send-email-verification.use-case.js';
export { UnlinkIdentityUseCase } from './unlink-identity.use-case.js';
export { VerifyEmailUseCase } from './verify-email.use-case.js';

/** The form of an email that makes one address one user. */
export function normalizeEmail(email: string): string {
  return UserEntity.normalizeEmail(email);
}
