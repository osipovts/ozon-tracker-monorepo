import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConsoleLoggerAdapter } from 'logger';
import { QueueMessageParser } from 'queue-worker';

import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { RATE_LIMITER, type RateLimiterPort } from '../shared/application/rate-limiter.port.js';
import { AppConfigParser } from '../shared/infrastructure/app-config.parser.js';
import { NestLoggerAdapter } from '../shared/infrastructure/nest-logger.adapter.js';
import { RedisRateLimiterAdapter } from '../shared/infrastructure/redis-rate-limiter.adapter.js';

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
      provide: QueueMessageParser,
      useFactory: (logger: LoggerPort): QueueMessageParser =>
        new QueueMessageParser(logger.child('results')),
      inject: [LOGGER],
    },
  ],
  exports: [APP_CONFIG, LOGGER, NestLoggerAdapter, QueueMessageParser, RATE_LIMITER],
})
export class CoreModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
