import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
  GetAccountUseCase,
  GetLinkedAccountsUseCase,
  type OauthProviderType,
  UnlinkIdentityUseCase,
} from '../../account/application/index.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import { NotSignedInError } from '../../shared/application/not-signed-in.error.js';
import { requireIdentity } from '../../shared/presentation/request-identity.type.js';
import { CloseAccountUseCase } from '../application/close-account.use-case.js';
import {
  accountDeletionBodySchema,
  type AccountDeletionBodyType,
  accountResponseSchema,
  type AccountResponseType,
  identityProviderParamSchema,
} from './account.type.js';
import { cookieOptionsOf } from './cookie-options.type.js';
import { sessionCookieName } from './session-cookie.parser.js';

@ApiTags('auth')
@Controller('auth')
export class AccountController {
  constructor(
    @Inject(GetAccountUseCase) private readonly getAccount: GetAccountUseCase,
    @Inject(GetLinkedAccountsUseCase) private readonly getLinked: GetLinkedAccountsUseCase,
    @Inject(UnlinkIdentityUseCase) private readonly unlink: UnlinkIdentityUseCase,
    @Inject(CloseAccountUseCase) private readonly closeAccount: CloseAccountUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfigInterface,
  ) {}

  @Get('account')
  @ApiOperation({ summary: 'The account of the user: the ways to log in' })
  @ApiOkResponse({ standardSchema: accountResponseSchema })
  async account(@Req() request: Request): Promise<AccountResponseType> {
    const { userId } = requireIdentity(request);
    const user = await this.getAccount.execute(userId);
    if (user === null) throw new NotSignedInError();

    const { hasPassword, identities } = await this.getLinked.execute(userId);

    return {
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
      hasPassword,
      identities: identities.map(({ provider, linkedAt }) => ({
        provider,
        linkedAt: linkedAt.toISOString(),
      })),
    };
  }

  @Delete('identities/:provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Stop logging in through a provider',
    description: 'The last way to log in cannot be taken away: delete the account instead.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'The account is not linked to the provider' })
  @ApiConflictResponse({ description: 'It is the only way to log in' })
  async unlinkIdentity(
    @Param('provider', { schema: identityProviderParamSchema }) provider: OauthProviderType,
    @Req() request: Request,
  ): Promise<void> {
    await this.unlink.execute(requireIdentity(request).userId, provider);
  }

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete the account for good',
    description:
      'With the products the user tracks (those nobody else tracks go with their price history), the ' +
      'sessions and the ways to log in. The body names the email of the account, to confirm.',
  })
  @ApiNoContentResponse()
  async deleteAccount(
    @Body({ schema: accountDeletionBodySchema }) body: AccountDeletionBodyType,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.closeAccount.execute(requireIdentity(request).userId, body.email);
    response.clearCookie(sessionCookieName, cookieOptionsOf(this.config));
  }
}
