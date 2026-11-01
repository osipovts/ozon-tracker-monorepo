import { expect, test } from 'vitest';

import { type JobStateInterface, summarizeJobs } from './job-summary.type.js';

function job(
  status: string | undefined,
  percent?: number,
  error: Error | null = null,
): JobStateInterface {
  return { status, percent, error };
}

test('has nothing to say while there are no jobs', () => {
  expect(summarizeJobs([])).toEqual({ percent: null, status: null, error: null });
});

test('averages the progress, and takes the status of a job that has not ended', () => {
  expect(summarizeJobs([job('completed', 100), job('running', 50)])).toEqual({
    percent: 75,
    status: 'running',
    error: null,
  });
});

test('says queued for a job nothing is known of yet', () => {
  expect(summarizeJobs([job('completed', 100), job(undefined)])).toMatchObject({
    percent: 50,
    status: 'queued',
  });
});

test('says failed when every job has ended and one of them failed, else completed', () => {
  expect(summarizeJobs([job('completed', 100), job('failed', 100)]).status).toBe('failed');
  expect(summarizeJobs([job('completed', 100), job('completed', 100)]).status).toBe('completed');
});

test('gives the first error of the jobs', () => {
  const broken = new Error('hub is down');

  expect(summarizeJobs([job('running', 10), job('running', 10, broken)]).error).toBe(broken);
});
