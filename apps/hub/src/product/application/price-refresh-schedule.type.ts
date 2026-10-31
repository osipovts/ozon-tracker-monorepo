export const hourMs = 3_600_000;

/** When the refresh of the prices runs: never, every so often, or at a minute of every hour (UTC). */
export type PriceRefreshScheduleType =
  { kind: 'off' } | { kind: 'interval'; intervalMs: number } | { kind: 'hourly'; minute: number };

/** An interval given is used, 0 turns the refresh off; with none, it runs every hour at the minute. */
export function priceRefreshScheduleOf(settings: {
  intervalMs: number | null;
  minute: number;
}): PriceRefreshScheduleType {
  if (settings.intervalMs === null) return { kind: 'hourly', minute: settings.minute };

  return settings.intervalMs <= 0
    ? { kind: 'off' }
    : { kind: 'interval', intervalMs: settings.intervalMs };
}

/** Time between two runs. */
export function schedulePeriodMs(schedule: PriceRefreshScheduleType): number {
  switch (schedule.kind) {
    case 'off':
      return hourMs;
    case 'interval':
      return schedule.intervalMs;
    case 'hourly':
      return hourMs;
  }
}

/** The first moment strictly after `after` that is `minute` minutes past a full hour, UTC. */
export function nextHourlyRunAfter(minute: number, after: Date): Date {
  const next = new Date(after);
  next.setUTCMinutes(minute, 0, 0);
  if (next <= after) next.setTime(next.getTime() + hourMs);

  return next;
}

/**
 * How old a price is when a run takes it. A price must not outlive the maximum age, so it is read at
 * the last run before it would: one that is a period younger than the maximum is read now, since the
 * next run is a period away. With a maximum age that is no longer than a period, every run reads it.
 */
export function dueAgeMs(maxAgeMs: number, periodMs: number): number {
  return Math.max(maxAgeMs - periodMs, 0);
}
