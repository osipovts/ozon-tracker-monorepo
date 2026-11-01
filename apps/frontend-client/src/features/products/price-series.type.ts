export type GranularityType = 'hour' | 'day';

export interface PricePointInterface {
  observedAt: Date;
  /** In kopecks. */
  amountMinor: number;
}

export interface PriceBucketInterface {
  /** The start of the hour or of the day, in the time of the browser. */
  start: Date;
  /** What the chart draws: the average of the bucket, else the last known price; null before the first price. */
  value: number | null;
  /** False when nothing was observed in the bucket and `value` is carried over from before it. */
  observed: boolean;
  /** Of the prices observed in the bucket; null when none. */
  min: number | null;
  max: number | null;
  last: number | null;
  average: number | null;
}

function startOfBucket(date: Date, granularity: GranularityType): Date {
  const start = new Date(date);
  if (granularity === 'hour') start.setMinutes(0, 0, 0);
  else start.setHours(0, 0, 0, 0);

  return start;
}

function nextBucket(start: Date, granularity: GranularityType): Date {
  const next = new Date(start);
  if (granularity === 'hour') next.setHours(next.getHours() + 1);
  else next.setDate(next.getDate() + 1);

  return next;
}

function previousBucket(start: Date, granularity: GranularityType): Date {
  const previous = new Date(start);
  if (granularity === 'hour') previous.setHours(previous.getHours() - 1);
  else previous.setDate(previous.getDate() - 1);

  return previous;
}

/** What the prices observed in a bucket come to; all null when there are none. */
function statsOf(
  amounts: number[],
): Pick<PriceBucketInterface, 'min' | 'max' | 'last' | 'average'> {
  if (amounts.length === 0) return { min: null, max: null, last: null, average: null };

  return {
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    last: amounts.at(-1) ?? null,
    average: Math.round(amounts.reduce((sum, amount): number => sum + amount, 0) / amounts.length),
  };
}

/**
 * The prices of the last `count` hours or days, a point for each: the average of the bucket. A bucket
 * with no price takes the last known one, and says that it was not observed.
 */
export function buildPriceSeries(
  points: PricePointInterface[],
  granularity: GranularityType,
  count: number,
  now: Date,
): PriceBucketInterface[] {
  const sorted = points.toSorted((a, b): number => a.observedAt.getTime() - b.observedAt.getTime());

  let first = startOfBucket(now, granularity);
  for (let step = 1; step < count; step += 1) first = previousBucket(first, granularity);

  // The last price before the first bucket carries into it.
  let carried: number | null = null;
  let index = 0;
  while (sorted[index] !== undefined && (sorted[index]?.observedAt ?? now) < first) {
    carried = sorted[index]?.amountMinor ?? null;
    index += 1;
  }

  const buckets: PriceBucketInterface[] = [];
  let start = first;
  for (let step = 0; step < count; step += 1) {
    const end = nextBucket(start, granularity);
    const amounts: number[] = [];
    for (
      let point = sorted[index];
      point !== undefined && point.observedAt < end;
      point = sorted[index]
    ) {
      amounts.push(point.amountMinor);
      index += 1;
    }

    const stats = statsOf(amounts);
    buckets.push({
      start,
      value: stats.average ?? carried,
      observed: stats.average !== null,
      ...stats,
    });
    carried = stats.last ?? carried;
    start = end;
  }

  return buckets;
}
