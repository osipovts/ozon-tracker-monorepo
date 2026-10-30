export interface AuthSessionInterface {
  id: string;
  userId: string;
  /** SHA-256 of the session token: a leaked table does not give a working session. */
  tokenHash: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  /** Moves forward while the session is used. */
  expiresAt: Date;
  /** The session ends here however active it is. */
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

export interface AuthSessionPolicyInterface {
  idleTtlMs: number;
  absoluteTtlMs: number;
}

export type AuthSessionStartInterface = Pick<
  AuthSessionInterface,
  'id' | 'userId' | 'tokenHash' | 'userAgent' | 'ip'
>;

/** A revoked or expired session stays so: using it does not revive it. */
export class AuthSessionEntity {
  constructor(readonly snapshot: AuthSessionInterface) {}

  static start(
    input: AuthSessionStartInterface,
    policy: AuthSessionPolicyInterface,
    at: Date,
  ): AuthSessionEntity {
    const absoluteExpiresAt = new Date(at.getTime() + policy.absoluteTtlMs);

    return new AuthSessionEntity({
      ...input,
      createdAt: at,
      lastSeenAt: at,
      expiresAt: new Date(Math.min(at.getTime() + policy.idleTtlMs, absoluteExpiresAt.getTime())),
      absoluteExpiresAt,
      revokedAt: null,
    });
  }

  isActive(at: Date): boolean {
    return this.snapshot.revokedAt === null && at < this.snapshot.expiresAt;
  }

  touched(policy: AuthSessionPolicyInterface, at: Date): AuthSessionEntity {
    if (!this.isActive(at)) return this;

    const idleExpiresAt = at.getTime() + policy.idleTtlMs;

    return new AuthSessionEntity({
      ...this.snapshot,
      lastSeenAt: at,
      expiresAt: new Date(Math.min(idleExpiresAt, this.snapshot.absoluteExpiresAt.getTime())),
    });
  }

  revoked(at: Date): AuthSessionEntity {
    if (this.snapshot.revokedAt !== null) return this;

    return new AuthSessionEntity({ ...this.snapshot, revokedAt: at });
  }
}
