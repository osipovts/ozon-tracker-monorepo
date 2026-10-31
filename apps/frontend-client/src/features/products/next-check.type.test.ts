import { expect, test } from 'vitest';

import { describeNextCheck } from './next-check.type.js';

const now = new Date('2026-10-31T12:00:00Z');

test('says nothing when the time is unknown', () => {
  expect(describeNextCheck(null, now, 'en')).toBeNull();
});

test('says soon for a time that has passed or is now', () => {
  expect(describeNextCheck('2026-10-31T11:00:00Z', now, 'en')).toEqual({ soon: true });
  expect(describeNextCheck('2026-10-31T12:00:00Z', now, 'en')).toEqual({ soon: true });
});

test('writes a time to come in the language and the time of the browser', () => {
  const next = '2026-10-31T16:00:00Z';
  const expected = new Date(next).toLocaleString('ru', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  expect(describeNextCheck(next, now, 'ru')).toEqual({ soon: false, when: expected });
});
