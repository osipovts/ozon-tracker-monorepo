import { z } from 'zod';

const jobCountsSchema = z.strictObject({
  queued: z.number().int(),
  running: z.number().int(),
  retrying: z.number().int(),
  completed: z.number().int(),
  failed: z.number().int(),
});

export const dashboardResponseSchema = z.strictObject({
  generatedAt: z.iso.datetime(),
  users: z.strictObject({
    total: z.number().int(),
    /** With the email proven to be theirs. */
    verified: z.number().int(),
    joinedLastDay: z.number().int(),
  }),
  products: z.strictObject({
    products: z.number().int(),
    /** What users track in all: a product that two of them track counts twice. */
    trackings: z.number().int(),
  }),
  proxies: z.strictObject({
    total: z.number().int(),
    alive: z.number().int(),
    /** Turned off by an administrator. */
    disabled: z.number().int(),
    /** Of the alive ones, in milliseconds. */
    averageLatencyMs: z.number().int().nullable(),
    lastCheckedAt: z.iso.datetime().nullable(),
  }),
  sessions: z.strictObject({
    /** Browser sessions the marketplaces still let through. */
    active: z.number().int(),
    stale: z.number().int(),
  }),
  jobs: z.strictObject({
    /** The jobs that started in the last day, by status. */
    lastDay: jobCountsSchema,
    recentFailures: z.array(
      z.strictObject({
        id: z.uuid(),
        kind: z.string(),
        subject: z.string(),
        error: z.string().nullable(),
        finishedAt: z.iso.datetime().nullable(),
      }),
    ),
  }),
});

export type DashboardResponseType = z.infer<typeof dashboardResponseSchema>;
