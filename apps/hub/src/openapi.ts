import 'reflect-metadata';

import { writeFile } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './composition/app.module.js';
import { apiDocumentOptions } from './composition/configure-application.js';

/**
 * Writes the OpenAPI document of the hub to the file in the first argument, for the admin panel to build
 * its types from. The application is created and not started, and nothing it connects to has to be there.
 */
const [target] = process.argv.slice(2);
if (target === undefined) throw new Error('Usage: node dist/openapi.js <file.json>');

process.env['DATABASE_URL'] ??= 'postgresql://localhost:5432/hub';
process.env['REDIS_URL'] ??= 'redis://127.0.0.1:1';
process.env['LOG_LEVEL'] ??= 'error';

const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  logger: false,
  bodyParser: false,
});
await writeFile(
  target,
  `${JSON.stringify(SwaggerModule.createDocument(app, apiDocumentOptions()), null, 2)}\n`,
);
// The queues the application opened wait for a Redis that is not there: leave without waiting for them.
process.exit(0);
