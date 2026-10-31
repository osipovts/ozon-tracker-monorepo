import { type LoggerPort, silentLogger } from 'logger';
import { z } from 'zod';

import { OauthLoginFailedError } from '../application/oauth-login-failed.error.js';
import type {
  OauthAuthorizationInterface,
  OauthExchangeInterface,
  OauthProfileInterface,
  OauthProviderPort,
} from '../application/oauth-provider.port.js';
import {
  type OauthClientInterface,
  OauthTokenExchangeAdapter,
} from './oauth-token-exchange.adapter.js';

export interface GithubEndpointsInterface {
  authorizeUrl: string;
  tokenUrl: string;
  userUrl: string;
  emailsUrl: string;
}

const githubEndpoints: GithubEndpointsInterface = {
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userUrl: 'https://api.github.com/user',
  emailsUrl: 'https://api.github.com/user/emails?per_page=100',
};

const requestTimeoutMs = 10_000;

const userSchema = z.object({ id: z.number().int() });
const emailsSchema = z.array(
  z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() }),
);

/** GitHub: the id of the user from `/user`, the email from `/user/emails`, since `/user` may hide it. */
export class GithubOauthProviderAdapter implements OauthProviderPort {
  private readonly tokens: OauthTokenExchangeAdapter;

  constructor(
    private readonly client: Omit<OauthClientInterface, 'tokenUrl'>,
    private readonly endpoints: GithubEndpointsInterface = githubEndpoints,
    private readonly logger: LoggerPort = silentLogger,
  ) {
    this.tokens = new OauthTokenExchangeAdapter({ ...client, tokenUrl: endpoints.tokenUrl });
  }

  authorizationUrl({ state, codeChallenge, redirectUri }: OauthAuthorizationInterface): string {
    const url = new URL(this.endpoints.authorizeUrl);
    url.search = new URLSearchParams([
      ['client_id', this.client.clientId],
      ['redirect_uri', redirectUri],
      ['scope', 'read:user user:email'],
      ['state', state],
      ['code_challenge', codeChallenge],
      ['code_challenge_method', 'S256'],
    ]).toString();

    return url.toString();
  }

  async fetchProfile(input: OauthExchangeInterface): Promise<OauthProfileInterface> {
    const accessToken = await this.tokens.exchange(input);

    const userResponse = await this.get(this.endpoints.userUrl, accessToken);
    const user = userSchema.safeParse(await userResponse.json().catch((): unknown => null));
    if (!userResponse.ok || !user.success) {
      throw new OauthLoginFailedError(`GitHub gave no user (HTTP ${String(userResponse.status)})`);
    }

    return { subject: String(user.data.id), ...(await this.primaryEmail(accessToken)) };
  }

  /** Only the primary email, and only if GitHub has verified it: any other is not proven to be theirs. */
  private async primaryEmail(
    accessToken: string,
  ): Promise<Pick<OauthProfileInterface, 'email' | 'emailVerified'>> {
    const response = await this.get(this.endpoints.emailsUrl, accessToken);
    // Without the scope, or without an email, the user stays unproven instead of the login failing.
    const emails = emailsSchema.safeParse(await response.json().catch((): unknown => null));
    const primary =
      response.ok && emails.success
        ? emails.data.find((item): boolean => item.primary && item.verified)
        : undefined;
    // Why a user is left unproven is the one thing the log must say: the login only tells them it was refused.
    if (!response.ok) {
      this.logger.warn(
        `GitHub refused the list of emails (HTTP ${String(response.status)}): an OAuth App needs the user:email scope, which this hub asks for; a GitHub App needs the "Email addresses" account permission`,
      );
    } else if (primary === undefined) {
      this.logger.warn('GitHub has no primary email that it has verified for this account');
    }

    return primary === undefined
      ? { email: null, emailVerified: false }
      : { email: primary.email, emailVerified: true };
  }

  private async get(url: string, accessToken: string): Promise<Response> {
    try {
      return await fetch(url, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/vnd.github+json',
          // GitHub refuses a request that does not say who it is.
          'user-agent': 'price-tracker-hub',
        },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      throw new OauthLoginFailedError('GitHub could not be reached');
    }
  }
}
