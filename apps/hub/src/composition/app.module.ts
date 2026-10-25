import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import { ApplicationErrorFilter } from '../presentation/shared/application-error.filter.js';
import { HttpLoggingInterceptor } from '../presentation/shared/http-logging.interceptor.js';
import { CoreModule } from './core.module.js';
import { JobModule } from './job.module.js';
import { ProductModule } from './product.module.js';
import { ProxyModule } from './proxy.module.js';
import { SessionModule } from './session.module.js';

/** The composition root: wires the adapters, the use cases and the controllers together. */
@Module({
  imports: [CoreModule, JobModule, SessionModule, ProxyModule, ProductModule],
  providers: [
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    { provide: APP_FILTER, useClass: ApplicationErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
  ],
})
export class AppModule {}
