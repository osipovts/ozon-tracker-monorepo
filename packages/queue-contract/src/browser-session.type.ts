import { z } from 'zod';

import { storageStateSchema } from './storage-state.type.js';

/** A browser session bound to the exit IP it was created with. */
export const browserSessionSchema = z.object({
  id: z.uuid(),
  exitIp: z.ipv4(),
  userAgent: z.string().min(1),
  storageState: storageStateSchema,
});
