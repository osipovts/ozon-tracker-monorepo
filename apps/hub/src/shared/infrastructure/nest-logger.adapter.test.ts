import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LoggerPort } from 'logger';

import { NestLoggerAdapter } from './nest-logger.adapter.js';

interface NoteInterface {
  level: string;
  context: string | null;
  message: string;
}

function recording(notes: NoteInterface[], context: string | null = null): LoggerPort {
  const note =
    (level: string) =>
    (message: string): void => {
      notes.push({ level, context, message });
    };

  return {
    error: note('error'),
    warn: note('warn'),
    info: note('info'),
    debug: note('debug'),
    verbose: note('verbose'),
    child: (name: string): LoggerPort => recording(notes, name),
  };
}

void test('sends the messages of Nest through the logger, under the context Nest names', (): void => {
  const notes: NoteInterface[] = [];
  const nest = new NestLoggerAdapter(recording(notes));

  nest.log('started', 'NestApplication');
  nest.warn('slow', 'Router');
  nest.debug('probe');
  nest.verbose('detail', 'Router');

  assert.deepEqual(notes, [
    { level: 'info', context: 'NestApplication', message: 'started' },
    { level: 'warn', context: 'Router', message: 'slow' },
    { level: 'debug', context: null, message: 'probe' },
    { level: 'verbose', context: 'Router', message: 'detail' },
  ]);
});

void test('writes an error with its stack under the context that follows it', (): void => {
  const notes: NoteInterface[] = [];

  new NestLoggerAdapter(recording(notes)).error('boom', 'at stack line', 'ExceptionHandler');
  new NestLoggerAdapter(recording(notes)).error('plain');

  assert.deepEqual(notes, [
    { level: 'error', context: 'ExceptionHandler', message: 'boom\nat stack line' },
    { level: 'error', context: null, message: 'plain' },
  ]);
});

void test('says what an object or an Error is, instead of [object Object]', (): void => {
  const notes: NoteInterface[] = [];
  const nest = new NestLoggerAdapter(recording(notes));

  nest.log({ port: 3000 });
  nest.log(new Error('bad config'));

  assert.deepEqual(
    notes.map((note): string => note.message),
    ['{"port":3000}', 'bad config'],
  );
});
