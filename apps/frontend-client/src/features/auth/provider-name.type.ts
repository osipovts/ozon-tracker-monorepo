import type { OauthProviderType } from './use-me.hook.js';

const names: Record<OauthProviderType, string> = { google: 'Google', github: 'GitHub' };

/** How a provider is called: its own name, in every language. */
export function providerName(provider: OauthProviderType): string {
  return names[provider];
}
