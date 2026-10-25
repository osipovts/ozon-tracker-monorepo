import { type LoggerPort, silentLogger } from 'logger';

import {
  BrowserSessionEntity,
  type StorageStateInterface,
} from '../../domain/session/browser-session.entity.js';
import type { BrowserSessionRepositoryPort } from './browser-session-repository.port.js';

export interface SessionImportInterface {
  id: string;
  marketplace: string;
  proxyServer: string | null;
  exitIp: string;
  userAgent: string;
  platform: string;
  browserVersion: string;
  storageState: StorageStateInterface;
  createdAt: Date;
}

export class ImportSessionUseCase {
  constructor(
    private readonly sessions: BrowserSessionRepositoryPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  /** A new session replaces the previous one of the same route. */
  async execute(input: SessionImportInterface): Promise<BrowserSessionEntity> {
    const routeKey = BrowserSessionEntity.routeKeyOf(input.proxyServer);
    const previous = await this.sessions.findByRoute(input.marketplace, routeKey);
    if (previous !== null && previous.snapshot.id !== input.id) {
      await this.sessions.delete(previous.snapshot.id);
      this.logger.info(`Session ${previous.snapshot.id} of ${routeKey} is replaced`);
    }
    const now = new Date();
    const session = new BrowserSessionEntity({
      ...input,
      status: 'active',
      staleReason: null,
      updatedAt: now,
      lastUsedAt: null,
    });
    await this.sessions.save(session);
    this.logger.info(
      `Imported session ${input.id} of ${input.marketplace} for ${routeKey}, exit ${input.exitIp}, ${String(input.storageState.cookies.length)} cookies`,
    );
    return session;
  }
}
