import type { ProxyProbeResultInterface } from './proxy-probe-result.interface.js';

export interface ProxyCheckInterface extends ProxyProbeResultInterface {
  /** Whether a list of the source named the proxy; false for one the hub only asked to check again. */
  seen: boolean;
}
