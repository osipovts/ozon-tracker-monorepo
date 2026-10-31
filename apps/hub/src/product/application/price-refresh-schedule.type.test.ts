import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  nextHourlyRunAfter,
  priceRefreshScheduleOf,
  schedulePeriodMs,
} from './price-refresh-schedule.type.js';

void test('runs at the minute of the hour that is next, not the one that is now', (): void => {
  assert.deepEqual(
    nextHourlyRunAfter(55, new Date('2026-10-31T14:20:30.500Z')),
    new Date('2026-10-31T14:55:00.000Z'),
  );
  assert.deepEqual(
    nextHourlyRunAfter(55, new Date('2026-10-31T14:55:00.000Z')),
    new Date('2026-10-31T15:55:00.000Z'),
  );
  assert.deepEqual(
    nextHourlyRunAfter(55, new Date('2026-10-31T14:58:00.000Z')),
    new Date('2026-10-31T15:55:00.000Z'),
  );
});

void test('crosses midnight and the end of the month', (): void => {
  assert.deepEqual(
    nextHourlyRunAfter(55, new Date('2026-10-31T23:56:00.000Z')),
    new Date('2026-11-01T00:55:00.000Z'),
  );
  assert.deepEqual(
    nextHourlyRunAfter(0, new Date('2026-10-31T23:30:00.000Z')),
    new Date('2026-11-01T00:00:00.000Z'),
  );
});

void test('an interval that is given wins, 0 turns it off, and with none it is hourly', (): void => {
  assert.deepEqual(priceRefreshScheduleOf({ intervalMs: null, minute: 55 }), {
    kind: 'hourly',
    minute: 55,
  });
  assert.deepEqual(priceRefreshScheduleOf({ intervalMs: 900_000, minute: 55 }), {
    kind: 'interval',
    intervalMs: 900_000,
  });
  assert.deepEqual(priceRefreshScheduleOf({ intervalMs: 0, minute: 55 }), { kind: 'off' });
});

void test('the period of a run is the interval, or an hour', (): void => {
  assert.equal(schedulePeriodMs({ kind: 'interval', intervalMs: 900_000 }), 900_000);
  assert.equal(schedulePeriodMs({ kind: 'hourly', minute: 55 }), 3_600_000);
});
