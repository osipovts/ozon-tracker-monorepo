export const RATE_LIMITER = Symbol('RateLimiterPort');

export interface RateLimitInterface {
  /** How many hits a key may make in a window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitVerdictInterface {
  allowed: boolean;
  /** How long until the window of the key ends; 0 for an allowed hit. */
  retryAfterMs: number;
}

export interface RateLimiterPort {
  /** Counts a hit of the key in its window, which starts with the first hit; a refused hit counts too. */
  hit(key: string, rule: RateLimitInterface): Promise<RateLimitVerdictInterface>;
}
