import type { OauthProviderType } from '../../account/application/index.js';
import type { OauthProvidersType } from './oauth-provider.port.js';

/** The providers a user can log in through: the ones whose OAuth app is set up. */
export class ListOauthProvidersUseCase {
  constructor(private readonly providers: OauthProvidersType) {}

  execute(): OauthProviderType[] {
    return [...this.providers.keys()];
  }
}
