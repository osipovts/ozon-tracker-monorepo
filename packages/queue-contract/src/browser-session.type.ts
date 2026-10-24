import { z } from 'zod';

import { storageStateSchema } from './storage-state.type.js';

/** A browser session bound to the exit IP it was created with. */
export const browserSessionSchema = z.object({
  id: z.uuid(),
  exitIp: z.ipv4(),
  userAgent: z.string().min(1),
  /** `process.platform` of the machine that created the session. */
  platform: z.string().min(1),
  browserVersion: z.string().min(1),
  storageState: storageStateSchema,
});

export type BrowserSessionType = z.infer<typeof browserSessionSchema>;

export const sessionWarningSchema = z.enum(['platform_mismatch', 'browser_version_mismatch']);

export type SessionWarningType = z.infer<typeof sessionWarningSchema>;
