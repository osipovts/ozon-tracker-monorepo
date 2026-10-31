import { randomUUID } from 'node:crypto';

import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import { hashSecretToken, issueSecretToken } from '../../shared/application/secret-token.type.js';
import {
  AuthSessionEntity,
  type AuthSessionPolicyInterface,
} from '../domain/auth-session.entity.js';
import type { AuthSessionRepositoryPort } from './auth-session-repository.port.js';

export interface StartAuthSessionInterface {
  userId: string;
  userAgent: string | null;
  ip: string | null;
}

export interface StartedAuthSessionInterface {
  /** Handed to the client once: only its hash is kept. */
  token: string;
  /** Where the session ends however active it is, which is how long the client may keep the token. */
  expiresAt: Date;
}

export class StartAuthSessionUseCase {
  constructor(
    private readonly sessions: AuthSessionRepositoryPort,
    private readonly policy: AuthSessionPolicyInterface,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async execute(input: StartAuthSessionInterface): Promise<StartedAuthSessionInterface> {
    const token = issueSecretToken();
    const session = AuthSessionEntity.start(
      { id: randomUUID(), tokenHash: hashSecretToken(token), ...input },
      this.policy,
      this.clock.now(),
    );
    await this.sessions.add(session);

    return { token, expiresAt: session.snapshot.absoluteExpiresAt };
  }
}
