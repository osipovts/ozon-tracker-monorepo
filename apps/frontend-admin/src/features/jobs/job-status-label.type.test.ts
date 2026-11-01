import { expect, test } from 'vitest';

import { createI18n } from '../../i18n/i18n.js';
import { jobStatusLabel } from './job-status-label.type.js';

const { t } = createI18n('en');

test('names the statuses the hub knows, and shows another one as it is', () => {
  expect(jobStatusLabel('queued', t)).toBe('queued');
  expect(jobStatusLabel('running', t)).toBe('running');
  expect(jobStatusLabel('retrying', t)).toBe('retrying');
  expect(jobStatusLabel('completed', t)).toBe('completed');
  expect(jobStatusLabel('failed', t)).toBe('failed');
  expect(jobStatusLabel('paused', t)).toBe('paused');
});
