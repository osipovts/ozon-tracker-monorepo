import { z } from 'zod';

import { browserSessionSchema } from './browser-session.type.js';
import { marketplaceSchema } from './marketplace.type.js';
import { proxyServerSchema } from './proxy-server.type.js';

/** A session captured by `session:onboard` and imported into the hub. */
export const sessionExportFileSchema = z.object({
  /** The marketplace the session was created on. */
  marketplace: marketplaceSchema,
  /** Proxy URL without credentials the session was created through, null for a direct connection. */
  proxy: proxyServerSchema.nullable(),
  session: browserSessionSchema,
  createdAt: z.iso.datetime(),
});

export type SessionExportFileType = z.infer<typeof sessionExportFileSchema>;
