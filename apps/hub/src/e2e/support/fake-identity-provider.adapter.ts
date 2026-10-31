import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ProviderProfileInterface {
  /** The id of the user at the provider. */
  subject: string;
  email: string | null;
  emailVerified: boolean;
}

interface GrantInterface {
  challenge: string;
  redirectUri: string;
  profile: ProviderProfileInterface;
}

/**
 * Stands in for Google and GitHub, which a test cannot reach: a real HTTP server with their endpoints. The
 * "user" consents to everything at once, and the token endpoint checks the PKCE verifier and the client
 * secret as the real ones do, so that a hub that gets either wrong fails here as it would there.
 */
export class FakeIdentityProviderAdapter {
  /** Who logs in at the provider next. */
  profile: ProviderProfileInterface = {
    subject: '1001',
    email: 'jane@example.com',
    emailVerified: true,
  };
  /** The user refuses at the provider. */
  deny = false;
  readonly clientId = 'e2e-client';
  readonly clientSecret = 'e2e-secret';
  private readonly grants = new Map<string, GrantInterface>();
  private readonly tokens = new Map<string, ProviderProfileInterface>();
  private readonly server: Server = createServer((request, response): void => {
    void this.handle(request).then(
      ({ status, headers, body }): void => {
        response.writeHead(status, { 'content-type': 'application/json', ...headers });
        response.end(body === null ? '' : JSON.stringify(body));
      },
      (): void => {
        response.writeHead(500);
        response.end();
      },
    );
  });
  private origin = '';

  async start(): Promise<string> {
    await new Promise<void>((resolve): void => {
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    if (address === null || typeof address === 'string')
      throw new Error('The provider did not start');
    this.origin = `http://127.0.0.1:${String((address satisfies AddressInfo).port)}`;

    return this.origin;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve): void => {
      this.server.close((): void => {
        resolve();
      });
    });
  }

  googleEndpoints(): { authorizeUrl: string; tokenUrl: string; userinfoUrl: string } {
    return {
      authorizeUrl: `${this.origin}/authorize`,
      tokenUrl: `${this.origin}/token`,
      userinfoUrl: `${this.origin}/userinfo`,
    };
  }

  githubEndpoints(): {
    authorizeUrl: string;
    tokenUrl: string;
    userUrl: string;
    emailsUrl: string;
  } {
    return {
      authorizeUrl: `${this.origin}/authorize`,
      tokenUrl: `${this.origin}/token`,
      userUrl: `${this.origin}/user`,
      emailsUrl: `${this.origin}/user/emails`,
    };
  }

  private async handle(
    request: IncomingMessage,
  ): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
    const url = new URL(request.url ?? '/', this.origin);
    const bearer = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1];
    const profile = bearer === undefined ? undefined : this.tokens.get(bearer);

    switch (`${request.method ?? ''} ${url.pathname}`) {
      case 'GET /authorize':
        return this.authorize(url);
      case 'POST /token':
        return this.token(new URLSearchParams(await this.readBody(request)));
      case 'GET /userinfo':
        return profile === undefined
          ? { status: 401, headers: {}, body: { error: 'invalid_token' } }
          : {
              status: 200,
              headers: {},
              body: {
                sub: profile.subject,
                ...(profile.email === null ? {} : { email: profile.email }),
                email_verified: profile.emailVerified,
              },
            };
      case 'GET /user':
        return profile === undefined
          ? { status: 401, headers: {}, body: { message: 'Bad credentials' } }
          : { status: 200, headers: {}, body: { id: Number(profile.subject), login: 'someone' } };
      case 'GET /user/emails':
        return profile === undefined
          ? { status: 401, headers: {}, body: { message: 'Bad credentials' } }
          : {
              status: 200,
              headers: {},
              body:
                profile.email === null
                  ? []
                  : [
                      {
                        email: profile.email,
                        primary: true,
                        verified: profile.emailVerified,
                        visibility: null,
                      },
                    ],
            };
      default:
        return { status: 404, headers: {}, body: { error: 'not found' } };
    }
  }

  /** The user is sent back to the hub with a code, or with the refusal. */
  private authorize(url: URL): { status: number; headers: Record<string, string>; body: null } {
    const redirectUri = url.searchParams.get('redirect_uri') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const back = new URL(redirectUri);
    back.searchParams.set('state', state);

    if (this.deny) {
      back.searchParams.set('error', 'access_denied');
    } else if (
      url.searchParams.get('client_id') !== this.clientId ||
      url.searchParams.get('code_challenge_method') !== 'S256' ||
      (url.searchParams.get('code_challenge') ?? '') === ''
    ) {
      back.searchParams.set('error', 'invalid_request');
    } else {
      const code = randomBytes(16).toString('hex');
      this.grants.set(code, {
        challenge: url.searchParams.get('code_challenge') ?? '',
        redirectUri,
        profile: { ...this.profile },
      });
      back.searchParams.set('code', code);
    }

    return { status: 302, headers: { location: back.toString() }, body: null };
  }

  private token(form: URLSearchParams): {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  } {
    const grant = this.grants.get(form.get('code') ?? '');
    this.grants.delete(form.get('code') ?? '');
    const verifier = form.get('code_verifier') ?? '';
    const proven = createHash('sha256').update(verifier).digest('base64url') === grant?.challenge;

    if (
      grant === undefined ||
      !proven ||
      form.get('client_id') !== this.clientId ||
      form.get('client_secret') !== this.clientSecret ||
      form.get('redirect_uri') !== grant.redirectUri ||
      form.get('grant_type') !== 'authorization_code'
    ) {
      return { status: 400, headers: {}, body: { error: 'invalid_grant' } };
    }

    const accessToken = randomBytes(16).toString('hex');
    this.tokens.set(accessToken, grant.profile);

    return { status: 200, headers: {}, body: { access_token: accessToken, token_type: 'bearer' } };
  }

  private async readBody(request: IncomingMessage): Promise<string> {
    let body = '';
    request.setEncoding('utf8');
    for await (const chunk of request) body += String(chunk);

    return body;
  }
}
