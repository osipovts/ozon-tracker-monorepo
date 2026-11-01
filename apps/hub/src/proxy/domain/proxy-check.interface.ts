export interface ProxyCheckInterface {
  /** Proxy URL without credentials. */
  server: string;
  source: string;
  alive: boolean;
  latencyMs: number | null;
  country: string | null;
  exitIp: string | null;
  checkedAt: Date;
  /** Whether a list of the source named the proxy; false for a recheck of one the store already holds. */
  seen: boolean;
}
