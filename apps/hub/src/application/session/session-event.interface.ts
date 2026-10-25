import type { StorageStateInterface } from '../../domain/session/browser-session.entity.js';

export type SessionEventInterface = { sessionId: string; at: Date } & (
  | { type: 'refreshed'; storageState: StorageStateInterface }
  | { type: 'stale'; reason: string }
  | { type: 'used' }
);
