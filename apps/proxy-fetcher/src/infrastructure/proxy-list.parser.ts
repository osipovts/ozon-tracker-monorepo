import { ProxyEndpointEntity } from 'proxy-endpoint';

export class ProxyListParser {
  /** Unique usable candidates of a text with a `protocol://ip:port` per line. */
  parse(text: string): ProxyEndpointEntity[] {
    const lines = new Set(text.split(/\r?\n/).map((value): string => value.trim()));

    const candidates: ProxyEndpointEntity[] = [];
    for (const line of lines) {
      try {
        candidates.push(new ProxyEndpointEntity(line));
      } catch {
        continue;
      }
    }

    return candidates;
  }
}
