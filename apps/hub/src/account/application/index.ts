/** What the other contexts may use of the account context. */
export type { OauthProviderType } from '../domain/oauth-provider.type.js';
export { oauthProviders } from '../domain/oauth-provider.type.js';
import { UserEntity } from '../domain/user.entity.js';

export type { UserInterface } from '../domain/user.entity.js';
export {
  AuthenticateWithPasswordUseCase,
  type PasswordLoginInterface,
} from './authenticate-with-password.use-case.js';
export {
  type ChangeAccountPasswordInterface,
  ChangeAccountPasswordUseCase,
} from './change-account-password.use-case.js';
export { GetAccountUseCase } from './get-account.use-case.js';
export {
  type RegisterAccountInterface,
  RegisterAccountUseCase,
} from './register-account.use-case.js';
export {
  type OauthAccountInterface,
  ResolveOauthAccountUseCase,
} from './resolve-oauth-account.use-case.js';

/** The form of an email that makes one address one user. */
export function normalizeEmail(email: string): string {
  return UserEntity.normalizeEmail(email);
}
