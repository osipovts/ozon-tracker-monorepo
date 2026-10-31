import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ConsoleLoggerAdapter, parseLogLevel } from './console-logger.adapter.js';

function capture(run: () => void): { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const log = console.log;
  const error = console.error;

  console.log = (line: string): void => {
    out.push(line);
  };
  console.error = (line: string): void => {
    err.push(line);
  };

  try {
    run();
  } finally {
    console.log = log;
    console.error = error;
  }

  return { out, err };
}

void test('writes messages up to the level and routes errors to stderr', (): void => {
  const { out, err } = capture((): void => {
    const logger = new ConsoleLoggerAdapter('debug', 'app').child('queue');
    logger.error('e');
    logger.warn('w');
    logger.info('i');
    logger.debug('d');
    logger.verbose('hidden');
  });

  assert.equal(err.length, 2);
  assert.equal(out.length, 2);
  assert.match(out[0] ?? '', /^\d{4}-\d\d-\d\dT[\d:.]+Z INFO\s+\[app:queue\] i$/);
});

void test('parses a level and falls back on garbage', (): void => {
  assert.equal(parseLogLevel(' Verbose ', 'info'), 'verbose');
  assert.equal(parseLogLevel('loud', 'info'), 'info');
  assert.equal(parseLogLevel(undefined, 'warn'), 'warn');
});
