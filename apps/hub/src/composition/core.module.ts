import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConsoleLoggerAdapter } from 'logger';
import { createTransport } from 'nodemailer';
import { QueueMessageParser } from 'queue-worker';

import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { MAILER, type MailerPort } from '../shared/application/mailer.port.js';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../shared/application/object-storage.port.js';
import { RATE_LIMITER, type RateLimiterPort } from '../shared/application/rate-limiter.port.js';
import { AppConfigParser } from '../shared/infrastructure/app-config.parser.js';
import { InMemoryObjectStorageAdapter } from '../shared/infrastructure/in-memory-object-storage.adapter.js';
import { LogMailerAdapter } from '../shared/infrastructure/log-mailer.adapter.js';
import { NestLoggerAdapter } from '../shared/infrastructure/nest-logger.adapter.js';
import { NodemailerMailerAdapter } from '../shared/infrastructure/nodemailer-mailer.adapter.js';
import { RedisRateLimiterAdapter } from '../shared/infrastructure/redis-rate-limiter.adapter.js';
import { S3ObjectStorageAdapter } from '../shared/infrastructure/s3-object-storage.adapter.js';

const REDIS = Symbol('Redis');

/** The configuration, the logging and the shared counters every module relies on. */
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
      provide: REDIS,
      // Without Redis a command fails after a few tries instead of hanging a login for good.
      useFactory: (config: AppConfigInterface): Redis =>
        new Redis(config.redisUrl, { maxRetriesPerRequest: 2 }),
      inject: [APP_CONFIG],
    },
    {
      provide: RATE_LIMITER,
      useFactory: (redis: Redis): RateLimiterPort => new RedisRateLimiterAdapter(redis),
      inject: [REDIS],
    },
    {
      provide: MAILER,
      useFactory: (config: AppConfigInterface, logger: LoggerPort): MailerPort => {
        if (config.smtpUrl !== null) {
          return new NodemailerMailerAdapter(createTransport(config.smtpUrl), config.mailFrom);
        }

        logger.warn('SMTP_URL is not set: the mails are written to the log, not sent');

        return new LogMailerAdapter(logger.child('mail'));
      },
      inject: [APP_CONFIG, LOGGER],
    },
    {
      provide: OBJECT_STORAGE,
      useFactory: (config: AppConfigInterface, logger: LoggerPort): ObjectStoragePort => {
        if (config.s3 !== null) return new S3ObjectStorageAdapter(config.s3, logger.child('s3'));

        logger.warn('S3_ENDPOINT is not set: the pictures of the products are not kept');

        return new InMemoryObjectStorageAdapter(false);
      },
      inject: [APP_CONFIG, LOGGER],
    },
    {
      provide: QueueMessageParser,
      useFactory: (logger: LoggerPort): QueueMessageParser =>
        new QueueMessageParser(logger.child('results')),
      inject: [LOGGER],
    },
  ],
  exports: [
    APP_CONFIG,
    LOGGER,
    NestLoggerAdapter,
    QueueMessageParser,
    RATE_LIMITER,
    MAILER,
    OBJECT_STORAGE,
  ],
})
export class CoreModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
