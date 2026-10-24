import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConsoleLoggerAdapter } from 'logger';

import { AppConfigParser } from './infrastructure/app-config.parser.js';
import { NestLoggerAdapter } from './infrastructure/nest-logger.adapter.js';
import { AppModule } from './presentation/app.module.js';

try {
  const config = new AppConfigParser().parse(process.env);
  const logger = new ConsoleLoggerAdapter(config.logLevel, 'hub');
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config, logger), {
    logger: new NestLoggerAdapter(logger),
  });
  // A session file carries the cookies and the local storage of the browser.
  app.useBodyParser('json', { limit: '10mb' });
  app.enableShutdownHooks();
  SwaggerModule.setup(
    'docs',
    app,
    () =>
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle('Hub')
          .setDescription('Proxies, browser sessions and price tracking of marketplace products')
          .setVersion('1.0')
          .build(),
      ),
    { jsonDocumentUrl: 'docs/json' },
  );
  await app.listen(config.port);
  logger.info(
    `Listening on http://localhost:${String(config.port)} (docs: /docs), log level ${config.logLevel}`,
  );
} catch (error: unknown) {
  console.error('Hub failed to start:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
}
