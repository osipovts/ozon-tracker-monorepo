import { Global, Module } from '@nestjs/common';
import { ConsoleLoggerAdapter } from 'logger';
import { QueueMessageParser } from 'queue-worker';

import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { AppConfigParser } from '../shared/infrastructure/app-config.parser.js';
import { NestLoggerAdapter } from '../shared/infrastructure/nest-logger.adapter.js';

/** The configuration and the logging every module relies on. */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfigInterface => new AppConfigParser().parse(process.env),
    },
    {
      provide: LOGGER,
      useFactory: (config: AppConfigInterface): LoggerPort =>
        new ConsoleLoggerAdapter(config.logLevel, 'hub'),
      inject: [APP_CONFIG],
    },
    {
      provide: NestLoggerAdapter,
      useFactory: (logger: LoggerPort): NestLoggerAdapter => new NestLoggerAdapter(logger),
      inject: [LOGGER],
    },
    {
      provide: QueueMessageParser,
      useFactory: (logger: LoggerPort): QueueMessageParser =>
        new QueueMessageParser(logger.child('results')),
      inject: [LOGGER],
    },
  ],
  exports: [APP_CONFIG, LOGGER, NestLoggerAdapter, QueueMessageParser],
})
export class CoreModule {}
