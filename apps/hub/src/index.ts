import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { errorMessage } from 'logger';

import { AppModule } from './composition/app.module.js';
import { configureApplication } from './composition/configure-application.js';
import { APP_CONFIG, type AppConfigInterface } from './shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from './shared/application/logger.port.js';
import { NestLoggerAdapter } from './shared/infrastructure/nest-logger.adapter.js';

try {
  // The logger of the application is a provider: Nest holds its own messages until it is ready.
  // A failed start throws here instead of ending the process inside Nest.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: false,
    // The limits of the body are set per route in `configureApplication`.
    bodyParser: false,
  });
  app.useLogger(app.get(NestLoggerAdapter));
  const config = app.get<AppConfigInterface>(APP_CONFIG);
  const logger = app.get<LoggerPort>(LOGGER);

  configureApplication(app);

  await app.listen(config.port);
  logger.info(
    `Listening on http://localhost:${String(config.port)} (docs: /docs), log level ${config.logLevel}`,
  );
} catch (error: unknown) {
  console.error('Hub failed to start:', errorMessage(error));
  process.exitCode = 1;
}
