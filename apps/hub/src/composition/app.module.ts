import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import { BrowserSessionModule } from '../browser-session/browser-session.module.js';
import { JobModule } from '../job/job.module.js';
import { ProductModule } from '../product/product.module.js';
import { ProxyModule } from '../proxy/proxy.module.js';
import { ApplicationErrorFilter } from '../shared/presentation/application-error.filter.js';
import { HttpLoggingInterceptor } from '../shared/presentation/http-logging.interceptor.js';
import { CoreModule } from './core.module.js';

/** The composition root: wires the adapters, the use cases and the controllers together. */
@Module({
  imports: [CoreModule, JobModule, BrowserSessionModule, ProxyModule, ProductModule],
  providers: [
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    { provide: APP_FILTER, useClass: ApplicationErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
  ],
})
export class AppModule {}
