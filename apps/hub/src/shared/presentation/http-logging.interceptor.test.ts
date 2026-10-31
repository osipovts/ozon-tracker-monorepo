import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CallHandler } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { of } from 'rxjs';

import type { LoggerPort } from '../application/logger.port.js';
import { HttpLoggingInterceptor } from './http-logging.interceptor.js';

function loggerInto(lines: string[]): LoggerPort {
  const note = (message: string): void => {
    lines.push(message);
  };

  return {
    error: note,
    warn: note,
    info: note,
    debug: note,
    verbose: note,
    child: (): LoggerPort => loggerInto(lines),
  };
}

void test('logs the path of a request and never its query: a callback carries a one-time code in it', async (): Promise<void> => {
  const lines: string[] = [];
  const context = new ExecutionContextHost([
    {
      method: 'GET',
      path: '/auth/oauth/google/callback',
      originalUrl: '/auth/oauth/google/callback?code=one-time-secret&state=abc',
    },
    { statusCode: 302 },
  ]);
  const next: CallHandler = { handle: () => of(null) };

  await new Promise<void>((resolve): void => {
    new HttpLoggingInterceptor(loggerInto(lines))
      .intercept(context, next)
      .subscribe({ complete: resolve });
  });

  assert.equal(lines.length, 2);
  assert.ok(lines.every((line): boolean => line.includes('GET /auth/oauth/google/callback')));
  assert.ok(
    lines.every((line): boolean => !line.includes('one-time-secret') && !line.includes('state=')),
  );
});
