export interface ProxyCheckInterface {
  /** Proxy URL without credentials. */
  server: string;
  source: string;
  alive: boolean;
  latencyMs: number | null;
  country: string | null;
  exitIp: string | null;
  checkedAt: Date;
}
