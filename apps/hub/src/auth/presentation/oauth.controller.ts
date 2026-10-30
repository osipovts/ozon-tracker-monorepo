import { Controller, Get, Inject, Param, Query, Redirect, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { oauthProviders, type OauthProviderType } from '../../account/application/index.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import { routeAccess } from '../../shared/presentation/route-access.type.js';
import { CompleteOauthLoginUseCase } from '../application/complete-oauth-login.use-case.js';
import { OauthLoginFailedError } from '../application/oauth-login-failed.error.js';
import { StartOauthLoginUseCase } from '../application/start-oauth-login.use-case.js';
import { cookieOptionsOf } from './cookie-options.type.js';
import {
  oauthLoginCookieMaxAgeMs,
  oauthLoginCookieName,
  OauthLoginCookieParser,
  oauthLoginCookiePath,
} from './oauth-login-cookie.parser.js';
import { sessionCookieName } from './session-cookie.parser.js';

const providerSchema = z.enum(oauthProviders);

/** What a provider sends the user back with: the code, or the reason it did not. */
const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
});

type CallbackQueryType = z.infer<typeof callbackQuerySchema>;

@ApiTags('auth')
@routeAccess('public')
@Controller('auth/oauth')
export class OauthController {
  constructor(
    @Inject(StartOauthLoginUseCase) private readonly startLogin: StartOauthLoginUseCase,
    @Inject(CompleteOauthLoginUseCase) private readonly completeLogin: CompleteOauthLoginUseCase,
    @Inject(OauthLoginCookieParser) private readonly loginCookies: OauthLoginCookieParser,
    @Inject(APP_CONFIG) private readonly config: AppConfigInterface,
  ) {}

  @Get(':provider/start')
  @Redirect()
  @ApiOperation({
    summary: 'Log in through a provider: send the browser to it',
    description:
      'Open it in the browser, not as an API call. Google and GitHub, when their OAuth apps are set up; ' +
      'the provider sends the user back to the callback, which logs them in.',
  })
  start(
    @Param('provider', { schema: providerSchema }) provider: OauthProviderType,
    @Res({ passthrough: true }) response: Response,
  ): { url: string } {
    const { url, state, codeVerifier } = this.startLogin.execute({
      provider,
      redirectUri: this.callbackUrl(provider),
    });
    response.cookie(oauthLoginCookieName, this.loginCookies.format({ state, codeVerifier }), {
      ...cookieOptionsOf(this.config),
      path: oauthLoginCookiePath,
      maxAge: oauthLoginCookieMaxAgeMs,
    });

    return { url };
  }

  @Get(':provider/callback')
  @Redirect()
  @ApiOperation({
    summary: 'Where the provider sends the user back to',
    description:
      'Logs the user in, signing them up on the first login: the session token comes in an ' +
      'HttpOnly cookie, and the user lands on a page of the hub.',
  })
  async callback(
    @Param('provider', { schema: providerSchema }) provider: OauthProviderType,
    @Query({ schema: callbackQuerySchema }) query: CallbackQueryType,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ url: string }> {
    const secret = this.loginCookies.parse(request.headers.cookie);
    // A login is tried once: whatever comes of it, the secret of it is spent.
    response.clearCookie(oauthLoginCookieName, {
      ...cookieOptionsOf(this.config),
      path: oauthLoginCookiePath,
    });

    if (query.error !== undefined) {
      throw new OauthLoginFailedError(`the provider answered ${query.error}`);
    }
    if (query.code === undefined || query.state === undefined) {
      throw new OauthLoginFailedError('the answer of the provider is incomplete');
    }
    if (secret === null)
      throw new OauthLoginFailedError('the login was not started in this browser');

    const { token, expiresAt } = await this.completeLogin.execute({
      provider,
      code: query.code,
      state: query.state,
      expectedState: secret.state,
      codeVerifier: secret.codeVerifier,
      redirectUri: this.callbackUrl(provider),
      userAgent: request.get('user-agent') ?? null,
      ip: request.ip ?? null,
    });
    response.cookie(sessionCookieName, token, {
      ...cookieOptionsOf(this.config),
      expires: expiresAt,
    });

    return { url: this.config.authSuccessRedirect };
  }

  private callbackUrl(provider: OauthProviderType): string {
    return `${this.config.publicUrl}/auth/oauth/${provider}/callback`;
  }
}
