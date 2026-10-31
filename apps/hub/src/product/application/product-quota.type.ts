import type { RateLimitInterface } from '../../shared/application/rate-limiter.port.js';

/** What a user may do with products: how many they track, and how fast they add. */
export interface ProductLimitsInterface {
  maxProducts: number;
  add: RateLimitInterface;
}
