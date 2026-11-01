export interface ProxyProbeResultInterface {
  /** Proxy URL without credentials. */
  server: string;
  alive: boolean;
  /** Duration of the successful check; null when the proxy is not alive. */
  latencyMs: number | null;
  country: string | null;
  exitIp: string | null;
  checkedAt: string;
}
