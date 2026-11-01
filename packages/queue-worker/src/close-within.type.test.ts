import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

import { closeWithin } from './close-within.type.js';

void test('asks the work to stop once the close takes longer than the deadline, and still waits for it', async (): Promise<void> => {
  let cancelled = 0;
  let closed = false;
  const closing = sleep(60).then((): void => {
    closed = true;
  });

  await closeWithin(
    closing,
    (): void => {
      cancelled += 1;
    },
    10,
  );

  assert.equal(cancelled, 1);
  assert.equal(closed, true);
});

void test('does not ask the work to stop when the close is in time', async (): Promise<void> => {
  let cancelled = 0;

  await closeWithin(
    sleep(5),
    (): void => {
      cancelled += 1;
    },
    30,
  );
  await sleep(50);

  assert.equal(cancelled, 0);
});

void test('does not ask the work to stop after a close that failed', async (): Promise<void> => {
  let cancelled = 0;

  await assert.rejects(
    closeWithin(
      Promise.reject(new Error('redis is gone')),
      (): void => {
        cancelled += 1;
      },
      20,
    ),
    /redis is gone/,
  );
  await sleep(40);

  assert.equal(cancelled, 0);
});
