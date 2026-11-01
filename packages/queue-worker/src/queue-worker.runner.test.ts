import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { Queue } from 'bullmq';
import { silentLogger } from 'logger';

import { QueueWorkerRunner } from './queue-worker.runner.js';

/** Needs a Redis: set TEST_REDIS_URL to run it (never one with data that matters). */
const redisUrl = process.env['TEST_REDIS_URL'];
const skip = redisUrl === undefined ? 'TEST_REDIS_URL is not set' : false;

function until(condition: () => boolean, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject): void => {
    const started = Date.now();
    const timer = setInterval((): void => {
      if (condition()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Timed out'));
      }
    }, 20);
  });
}

void test(
  'a stop waits for a job that ends in time, and asks one that does not to stop',
  { skip },
  async (): Promise<void> => {
    assert.ok(redisUrl !== undefined);
    const jobsQueue = `jobs-${randomUUID()}`;
    const jobs = new Queue(jobsQueue, { connection: { url: redisUrl } });
    const runner = new QueueWorkerRunner(
      { redisUrl, jobsQueue, concurrency: 1, cancelAfterMs: 300 },
      silentLogger,
    );
    let aborted = false;
    let started = false;
    runner.start(async (_data, signal): Promise<void> => {
      started = true;
      // A job that would run for minutes, and stops only when it is asked to.
      await new Promise<void>((resolve): void => {
        signal.addEventListener(
          'abort',
          (): void => {
            aborted = true;
            resolve();
          },
          { once: true },
        );
      });
    });
    await jobs.add('job', { jobId: randomUUID() });
    await until((): boolean => started);

    const stopping = Date.now();
    await runner.close();

    assert.equal(aborted, true);
    assert.ok(Date.now() - stopping < 5000);
    await jobs.close();
  },
);

void test(
  'a stop does not ask a job to stop that ends before the time is up',
  { skip },
  async (): Promise<void> => {
    assert.ok(redisUrl !== undefined);
    const jobsQueue = `jobs-${randomUUID()}`;
    const jobs = new Queue(jobsQueue, { connection: { url: redisUrl } });
    const runner = new QueueWorkerRunner(
      { redisUrl, jobsQueue, concurrency: 1, cancelAfterMs: 5000 },
      silentLogger,
    );
    let aborted = false;
    let finished = false;
    let started = false;
    runner.start(async (_data, signal): Promise<void> => {
      started = true;
      signal.addEventListener(
        'abort',
        (): void => {
          aborted = true;
        },
        { once: true },
      );
      await new Promise((resolve): void => {
        setTimeout(resolve, 200);
      });
      finished = true;
    });
    await jobs.add('job', { jobId: randomUUID() });
    await until((): boolean => started);

    await runner.close();

    assert.equal(finished, true);
    assert.equal(aborted, false);
    await jobs.close();
  },
);
