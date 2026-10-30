export const oauthProviders = ['google', 'github'] as const;

export type OauthProviderType = (typeof oauthProviders)[number];
