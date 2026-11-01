import { type ArgumentsHost, Catch, type ExceptionFilter, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import { NotSignedInError } from '../../shared/application/not-signed-in.error.js';
import { ApplicationErrorFilter } from '../../shared/presentation/application-error.filter.js';

/**
 * The link of the mail is opened in a browser that may not be the one the user signed up in. Where the
 * app has a login page, the user is sent to it with the token of the link, and the page finishes the
 * confirmation once the login is done; otherwise the refusal is an error of the API.
 */
@Catch(NotSignedInError)
export class VerificationLinkSignInFilter implements ExceptionFilter<NotSignedInError> {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfigInterface) {}

  catch(exception: NotSignedInError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const token = http.getRequest<Request>().query['token'];
    if (this.config.authFailureRedirect === null || typeof token !== 'string') {
      new ApplicationErrorFilter().catch(exception, host);

      return;
    }

    http
      .getResponse<Response>()
      .redirect(`${this.config.authFailureRedirect}?verify=${encodeURIComponent(token)}`);
  }
}
