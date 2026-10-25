import assert from 'node:assert/strict';
import { test } from 'node:test';

import { JobEntity } from './job.entity.js';

const at = (second: number): Date => new Date(Date.UTC(2026, 9, 24, 12, 0, second));
const job = JobEntity.queued(
  '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
  'proxy_fetch',
  'src',
  null,
  at(0),
);

void test('follows a job from queued to completed with its progress', (): void => {
  const running = job.progressed({ percent: 40, processed: 8, total: 20, succeeded: 3 }, at(5));
  assert.equal(running.snapshot.status, 'running');
  assert.equal(running.snapshot.percent, 40);
  assert.equal(running.snapshot.total, 20);
  assert.equal(running.snapshot.startedAt?.getTime(), at(5).getTime());
  const done = running.completed(at(9));
  assert.equal(done.snapshot.status, 'completed');
  assert.equal(done.snapshot.percent, 100);
  assert.equal(done.snapshot.processed, 8);
  assert.equal(done.snapshot.finishedAt?.getTime(), at(9).getTime());
});

void test('keeps the first start time and distinguishes a retried failure from a final one', (): void => {
  const started = job.started(at(1));
  assert.equal(started.started(at(7)).snapshot.startedAt?.getTime(), at(1).getTime());
  const retrying = started.failed('Browser crashed', true, at(3));
  assert.equal(retrying.snapshot.status, 'retrying');
  assert.equal(retrying.snapshot.finishedAt, null);
  assert.equal(retrying.started(at(10)).snapshot.error, null);
  const failed = retrying.failed('Browser crashed', false, at(12));
  assert.equal(failed.snapshot.status, 'failed');
  assert.equal(failed.snapshot.error, 'Browser crashed');
  assert.equal(failed.snapshot.finishedAt?.getTime(), at(12).getTime());
});

void test('ignores events after the job has finished', (): void => {
  const done = job.completed(at(2));
  assert.equal(done.progressed({ percent: 10, processed: 1, total: 5, succeeded: 1 }, at(3)), done);
  assert.equal(done.failed('late', false, at(4)), done);
  assert.equal(done.started(at(5)), done);
});
