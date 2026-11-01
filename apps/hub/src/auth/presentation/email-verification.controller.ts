import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';

import { VerifyEmailUseCase } from '../../account/application/index.js';
import { requireIdentity } from '../../shared/presentation/request-identity.type.js';
import { ResendEmailVerificationUseCase } from '../application/resend-email-verification.use-case.js';
import { verifiedResponseSchema, type VerifiedResponseType } from './auth.type.js';
import { VerificationLinkSignInFilter } from './verification-link-sign-in.filter.js';

const verifyQuerySchema = z.object({ token: z.string().min(1).max(200) });

type VerifyQueryType = z.infer<typeof verifyQuerySchema>;

@ApiTags('auth')
@Controller('auth/verify-email')
export class EmailVerificationController {
  constructor(
    @Inject(VerifyEmailUseCase) private readonly verifyEmail: VerifyEmailUseCase,
    @Inject(ResendEmailVerificationUseCase)
    private readonly resendVerification: ResendEmailVerificationUseCase,
  ) {}

  @Get()
  @UseFilters(VerificationLinkSignInFilter)
  @ApiOperation({
    summary: 'Confirm the email: the link mailed to it',
    description:
      'Open the link of the mail in the browser the user is signed in with. It works until it expires, ' +
      'and opening it again is harmless. Nobody else can confirm the email, even with the mailbox: ' +
      'whoever signed up set the password.',
  })
  @ApiOkResponse({ standardSchema: verifiedResponseSchema })
  @ApiBadRequestResponse({
    description: 'The link is wrong, has expired, or was mailed for another user',
  })
  @ApiUnauthorizedResponse({
    description:
      'No live session: where the app has a login page, a redirect to it with `?verify=<token>`',
  })
  async verify(
    @Query({ schema: verifyQuerySchema }) query: VerifyQueryType,
    @Req() request: Request,
  ): Promise<VerifiedResponseType> {
    await this.verifyEmail.execute(query.token, requireIdentity(request).userId);

    return { verified: true };
  }

  @Post('resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mail the link to confirm the email again',
    description:
      'For a user who lost it: the earlier link stops working. Only so many times a window.',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'No live session' })
  @ApiTooManyRequestsResponse({ description: 'Asked too often' })
  async resend(@Req() request: Request): Promise<void> {
    await this.resendVerification.execute(requireIdentity(request).userId);
  }
}
