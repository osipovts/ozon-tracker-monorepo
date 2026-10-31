import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';

import { GetAccountUseCase, type UserInterface } from '../../account/application/index.js';
import { EndAuthSessionUseCase } from '../../auth-session/application/index.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import { NotSignedInError } from '../../shared/application/not-signed-in.error.js';
import { requireIdentity } from '../../shared/presentation/request-identity.type.js';
import { routeAccess } from '../../shared/presentation/route-access.type.js';
import type { ClientInterface } from '../application/authenticated-session.interface.js';
import { ChangePasswordUseCase } from '../application/change-password.use-case.js';
import { LogInUseCase } from '../application/log-in.use-case.js';
import { SignUpUseCase } from '../application/sign-up.use-case.js';
import {
  authResponseSchema,
  type AuthResponseType,
  loginBodySchema,
  type LoginBodyType,
  passwordChangeBodySchema,
  type PasswordChangeBodyType,
  registerBodySchema,
  type RegisterBodyType,
  registeredResponseSchema,
  type RegisteredResponseType,
} from './auth.type.js';
import { cookieOptionsOf } from './cookie-options.type.js';
import { sessionCookieName, SessionCookieParser } from './session-cookie.parser.js';

function toAuthResponse({ id, email }: UserInterface): AuthResponseType {
  return { user: { id, email } };
}

function clientOf(request: Request): ClientInterface {
  return { userAgent: request.get('user-agent') ?? null, ip: request.ip ?? null };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    @Inject(SignUpUseCase) private readonly signUp: SignUpUseCase,
    @Inject(LogInUseCase) private readonly logIn: LogInUseCase,
    @Inject(EndAuthSessionUseCase) private readonly endSession: EndAuthSessionUseCase,
    @Inject(GetAccountUseCase) private readonly getAccount: GetAccountUseCase,
    @Inject(ChangePasswordUseCase) private readonly changePassword: ChangePasswordUseCase,
    @Inject(SessionCookieParser) private readonly cookies: SessionCookieParser,
    @Inject(APP_CONFIG) config: AppConfigInterface,
  ) {
    this.cookieOptions = cookieOptionsOf(config);
  }

  @Post('register')
  @routeAccess('public')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Sign up by the email and the password',
    description:
      'Answers the same whether the email was free or not, so that it does not tell which emails have ' +
      'an account, and starts no session: log in with `POST /auth/login` after it.',
  })
  @ApiAcceptedResponse({ standardSchema: registeredResponseSchema })
  async register(
    @Body({ schema: registerBodySchema }) body: RegisterBodyType,
    @Req() request: Request,
  ): Promise<RegisteredResponseType> {
    await this.signUp.execute({ ...body, ip: clientOf(request).ip });

    return { accepted: true };
  }

  @Post('login')
  @routeAccess('public')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in by the email and the password',
    description: 'Every login is a session of its own: the token comes in an HttpOnly cookie.',
  })
  @ApiOkResponse({ standardSchema: authResponseSchema })
  @ApiUnauthorizedResponse({ description: 'The email or the password is wrong' })
  async login(
    @Body({ schema: loginBodySchema }) body: LoginBodyType,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseType> {
    const { user, token, expiresAt } = await this.logIn.execute({ ...body, ...clientOf(request) });
    response.cookie(sessionCookieName, token, { ...this.cookieOptions, expires: expiresAt });

    return toAuthResponse(user);
  }

  @Post('logout')
  @routeAccess('public')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'End the session of the cookie',
    description: 'Harmless without a session or with one that has ended already.',
  })
  @ApiNoContentResponse()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = this.cookies.parse(request.headers.cookie);
    if (token !== null) await this.endSession.execute(token);

    response.clearCookie(sessionCookieName, this.cookieOptions);
  }

  @Get('me')
  @ApiOperation({ summary: 'The user of the session cookie' })
  @ApiOkResponse({ standardSchema: authResponseSchema })
  @ApiUnauthorizedResponse({ description: 'No live session' })
  async me(@Req() request: Request): Promise<AuthResponseType> {
    const user = await this.getAccount.execute(requireIdentity(request).userId);
    if (user === null) throw new NotSignedInError();

    return toAuthResponse(user);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change the password',
    description:
      'Needs the current password. Signs the user out of every other device; this session stays.',
  })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'The current password is wrong' })
  @ApiUnauthorizedResponse({ description: 'No live session' })
  async password(
    @Body({ schema: passwordChangeBodySchema }) body: PasswordChangeBodyType,
    @Req() request: Request,
  ): Promise<void> {
    const { userId, sessionId } = requireIdentity(request);
    await this.changePassword.execute({ userId, sessionId, ...body });
  }
}
